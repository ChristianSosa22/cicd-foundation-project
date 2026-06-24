# Discover the available AZs in the current region and slice to az_count
data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_region" "current" {}

locals {
  azs       = slice(data.aws_availability_zones.available.names, 0, var.az_count)
  nat_count = var.single_nat_gateway ? 1 : var.az_count

  common_tags = {
    Environment = var.environment
    Project     = var.name
    ManagedBy   = "terraform"
  }
}

# ── VPC ────────────────────────────────────────────────────────────────────────
resource "aws_vpc" "this" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = merge(local.common_tags, {
    Name = "${var.name}-${var.environment}-vpc"
  })
}

# ── Subnets ────────────────────────────────────────────────────────────────────

# Public subnets — one per AZ. Resources here receive a public IP by default.
# The ALB (provisioned in a follow-up task) will live in these subnets.
resource "aws_subnet" "public" {
  count                   = var.az_count
  vpc_id                  = aws_vpc.this.id
  cidr_block              = var.public_subnet_cidrs[count.index]
  availability_zone       = local.azs[count.index]
  map_public_ip_on_launch = true

  tags = merge(local.common_tags, {
    Name = "${var.name}-${var.environment}-public-${local.azs[count.index]}"
    Tier = "public"
  })
}

# Private application subnets — one per AZ. ECS Fargate tasks live here.
# No direct internet route; egress is via the NAT Gateway.
resource "aws_subnet" "private_app" {
  count             = var.az_count
  vpc_id            = aws_vpc.this.id
  cidr_block        = var.private_app_subnet_cidrs[count.index]
  availability_zone = local.azs[count.index]

  tags = merge(local.common_tags, {
    Name = "${var.name}-${var.environment}-private-app-${local.azs[count.index]}"
    Tier = "app"
  })
}

# Private data subnets — one per AZ. RDS instances are isolated here.
# These subnets have no route to a NAT Gateway or the Internet Gateway;
# the database is reachable only from within the VPC (app tier via its SG).
resource "aws_subnet" "private_data" {
  count             = var.az_count
  vpc_id            = aws_vpc.this.id
  cidr_block        = var.private_data_subnet_cidrs[count.index]
  availability_zone = local.azs[count.index]

  tags = merge(local.common_tags, {
    Name = "${var.name}-${var.environment}-private-data-${local.azs[count.index]}"
    Tier = "data"
  })
}

# ── Internet Gateway ───────────────────────────────────────────────────────────
resource "aws_internet_gateway" "this" {
  vpc_id = aws_vpc.this.id

  tags = merge(local.common_tags, {
    Name = "${var.name}-${var.environment}-igw"
  })
}

# ── NAT Gateways ───────────────────────────────────────────────────────────────
# Only created when enable_nat_gateway=true. Set false when ECS tasks run in
# public subnets (assign_public_ip=true) to eliminate the ~$32+/month NAT cost.
resource "aws_eip" "nat" {
  count  = var.enable_nat_gateway ? local.nat_count : 0
  domain = "vpc"

  tags = merge(local.common_tags, {
    Name = "${var.name}-${var.environment}-eip-nat-${count.index}"
  })

  depends_on = [aws_internet_gateway.this]
}

resource "aws_nat_gateway" "this" {
  count         = var.enable_nat_gateway ? local.nat_count : 0
  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id

  tags = merge(local.common_tags, {
    Name = "${var.name}-${var.environment}-nat-${count.index}"
  })

  depends_on = [aws_internet_gateway.this]
}

# ── Route Tables ───────────────────────────────────────────────────────────────

# Public route table (explicit — not the VPC default route table)
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.this.id

  tags = merge(local.common_tags, {
    Name = "${var.name}-${var.environment}-rt-public"
  })
}

# Default route: all public-subnet traffic exits through the Internet Gateway
resource "aws_route" "public_igw" {
  route_table_id         = aws_route_table.public.id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.this.id
}

# Associate every public subnet with the public route table
resource "aws_route_table_association" "public" {
  count          = var.az_count
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# Private route tables — one per NAT Gateway (i.e., one when single_nat=true, one per AZ otherwise)
resource "aws_route_table" "private" {
  count  = local.nat_count
  vpc_id = aws_vpc.this.id

  tags = merge(local.common_tags, {
    Name = "${var.name}-${var.environment}-rt-private-${count.index}"
  })
}

# Default route: private-subnet traffic exits through the NAT Gateway.
# Only created when enable_nat_gateway=true.
resource "aws_route" "private_nat" {
  count                  = var.enable_nat_gateway ? local.nat_count : 0
  route_table_id         = aws_route_table.private[count.index].id
  destination_cidr_block = "0.0.0.0/0"
  nat_gateway_id         = aws_nat_gateway.this[count.index].id
}

# Associate each private application subnet with its route table.
# When single_nat_gateway=true: all subnets share private[0].
# When single_nat_gateway=false: subnet i routes through its AZ-local NAT private[i].
resource "aws_route_table_association" "private_app" {
  count          = var.az_count
  subnet_id      = aws_subnet.private_app[count.index].id
  route_table_id = aws_route_table.private[var.single_nat_gateway ? 0 : count.index].id
}

# ── Data route table ───────────────────────────────────────────────────────────
# Dedicated route table for the data tier with no default (0.0.0.0/0) route.
# Only the implicit VPC-local route applies, so RDS has no path to the internet
# in either direction — true network isolation for the database subnets.
resource "aws_route_table" "data" {
  vpc_id = aws_vpc.this.id

  tags = merge(local.common_tags, {
    Name = "${var.name}-${var.environment}-rt-data"
  })
}

# Associate every data subnet with the isolated data route table.
resource "aws_route_table_association" "private_data" {
  count          = var.az_count
  subnet_id      = aws_subnet.private_data[count.index].id
  route_table_id = aws_route_table.data.id
}

# ── VPC Endpoints ──────────────────────────────────────────────────────────────
# Gateway endpoints (S3, DynamoDB) are FREE. Interface endpoints (~$7.20/mo each)
# run in the private app subnets and need the vpce SG for ingress control.

# Security group for Interface VPC Endpoints.
# Ingress: 443/tcp from the VPC CIDR (covers app, lambda, and data tiers).
# Egress: deny-all (endpoint ENIs only receive traffic, they don't initiate).
resource "aws_security_group" "vpce" {
  count = var.create_vpc_endpoints ? 1 : 0

  name        = "${var.name}-${var.environment}-vpce-sg"
  description = "VPC Endpoint tier: ingress 443 from VPC-internal traffic only"
  vpc_id      = aws_vpc.this.id

  tags = merge(local.common_tags, {
    Name = "${var.name}-${var.environment}-vpce-sg"
  })
}

resource "aws_security_group_rule" "vpce_ingress_vpc" {
  count = var.create_vpc_endpoints ? 1 : 0

  type              = "ingress"
  security_group_id = aws_security_group.vpce[0].id
  from_port         = 443
  to_port           = 443
  protocol          = "tcp"
  cidr_blocks       = [var.vpc_cidr]
  description       = "Ingress from VPC-internal traffic on HTTPS"
}

# Gateway endpoint for S3 — FREE, no ENIs. Prefix list added to specified RTs.
# aws_route_table.private always exists (count = nat_count ≥ 1) even when
# enable_nat_gateway=false, so we can always use it regardless of NAT config.
resource "aws_vpc_endpoint" "s3" {
  count = var.create_vpc_endpoints ? 1 : 0

  vpc_id            = aws_vpc.this.id
  service_name      = "com.amazonaws.${data.aws_region.current.name}.s3"
  vpc_endpoint_type = "Gateway"

  route_table_ids = aws_route_table.private[*].id

  tags = merge(local.common_tags, {
    Name = "${var.name}-${var.environment}-vpce-s3"
  })
}

# Interface endpoints — one per service. All share the vpce SG and private_app subnets.
locals {
  vpce_services = {
    sqs            = "com.amazonaws.${data.aws_region.current.name}.sqs"
    sns            = "com.amazonaws.${data.aws_region.current.name}.sns"
    logs           = "com.amazonaws.${data.aws_region.current.name}.logs"
    secretsmanager = "com.amazonaws.${data.aws_region.current.name}.secretsmanager"
    ssm            = "com.amazonaws.${data.aws_region.current.name}.ssm"
  }
}

resource "aws_vpc_endpoint" "interface" {
  for_each = var.create_vpc_endpoints ? local.vpce_services : {}

  vpc_id              = aws_vpc.this.id
  service_name        = each.value
  vpc_endpoint_type   = "Interface"
  subnet_ids          = aws_subnet.private_app[*].id
  security_group_ids  = [aws_security_group.vpce[0].id]
  private_dns_enabled = true

  tags = merge(local.common_tags, {
    Name = "${var.name}-${var.environment}-vpce-${each.key}"
  })
}
