# Discover the available AZs in the current region and slice to az_count
data "aws_availability_zones" "available" {
  state = "available"
}

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

# Private subnets — one per AZ. ECS tasks and RDS instances live here.
# No direct internet route; egress is via the NAT Gateway.
resource "aws_subnet" "private" {
  count             = var.az_count
  vpc_id            = aws_vpc.this.id
  cidr_block        = var.private_subnet_cidrs[count.index]
  availability_zone = local.azs[count.index]

  tags = merge(local.common_tags, {
    Name = "${var.name}-${var.environment}-private-${local.azs[count.index]}"
    Tier = "private"
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
# Elastic IPs for the NAT Gateways.
# Count is 1 when single_nat_gateway=true, or az_count when per-AZ.
resource "aws_eip" "nat" {
  count  = local.nat_count
  domain = "vpc"

  tags = merge(local.common_tags, {
    Name = "${var.name}-${var.environment}-eip-nat-${count.index}"
  })

  depends_on = [aws_internet_gateway.this]
}

# NAT Gateways — placed in public subnets so they can reach the Internet Gateway.
resource "aws_nat_gateway" "this" {
  count         = local.nat_count
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

# Default route: private-subnet traffic exits through the NAT Gateway
resource "aws_route" "private_nat" {
  count                  = local.nat_count
  route_table_id         = aws_route_table.private[count.index].id
  destination_cidr_block = "0.0.0.0/0"
  nat_gateway_id         = aws_nat_gateway.this[count.index].id
}

# Associate each private subnet with its route table.
# When single_nat_gateway=true: all subnets share private[0].
# When single_nat_gateway=false: subnet i routes through its AZ-local NAT private[i].
resource "aws_route_table_association" "private" {
  count          = var.az_count
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private[var.single_nat_gateway ? 0 : count.index].id
}
