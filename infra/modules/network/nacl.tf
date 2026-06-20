# ── Public NACL ──────────────────────────────────────────────────────────────
# Applies to all public subnets. Stateless rules for ALB ingress/egress.
resource "aws_network_acl" "public" {
  vpc_id = aws_vpc.this.id

  tags = merge(local.common_tags, {
    Name = "${var.name}-${var.environment}-nacl-public"
  })
}

# Inbound: HTTP
resource "aws_network_acl_rule" "public_in_http" {
  network_acl_id = aws_network_acl.public.id
  rule_number    = 100
  egress         = false
  protocol       = "tcp"
  rule_action    = "allow"
  cidr_block     = "0.0.0.0/0"
  from_port      = var.http_port
  to_port        = var.http_port
}

# Inbound: HTTPS
resource "aws_network_acl_rule" "public_in_https" {
  network_acl_id = aws_network_acl.public.id
  rule_number    = 110
  egress         = false
  protocol       = "tcp"
  rule_action    = "allow"
  cidr_block     = "0.0.0.0/0"
  from_port      = var.https_port
  to_port        = var.https_port
}

# Inbound: ephemeral (return traffic for outbound requests)
resource "aws_network_acl_rule" "public_in_ephemeral" {
  network_acl_id = aws_network_acl.public.id
  rule_number    = 120
  egress         = false
  protocol       = "tcp"
  rule_action    = "allow"
  cidr_block     = "0.0.0.0/0"
  from_port      = var.ephemeral_from
  to_port        = var.ephemeral_to
}

# Outbound: HTTP
resource "aws_network_acl_rule" "public_out_http" {
  network_acl_id = aws_network_acl.public.id
  rule_number    = 100
  egress         = true
  protocol       = "tcp"
  rule_action    = "allow"
  cidr_block     = "0.0.0.0/0"
  from_port      = var.http_port
  to_port        = var.http_port
}

# Outbound: HTTPS
resource "aws_network_acl_rule" "public_out_https" {
  network_acl_id = aws_network_acl.public.id
  rule_number    = 110
  egress         = true
  protocol       = "tcp"
  rule_action    = "allow"
  cidr_block     = "0.0.0.0/0"
  from_port      = var.https_port
  to_port        = var.https_port
}

# Outbound: ephemeral (return traffic to internet)
resource "aws_network_acl_rule" "public_out_ephemeral" {
  network_acl_id = aws_network_acl.public.id
  rule_number    = 120
  egress         = true
  protocol       = "tcp"
  rule_action    = "allow"
  cidr_block     = "0.0.0.0/0"
  from_port      = var.ephemeral_from
  to_port        = var.ephemeral_to
}

# Outbound: app port to private app subnets (ALB -> API)
resource "aws_network_acl_rule" "public_out_app" {
  network_acl_id = aws_network_acl.public.id
  rule_number    = 130
  egress         = true
  protocol       = "tcp"
  rule_action    = "allow"
  cidr_block     = var.vpc_cidr
  from_port      = var.app_port
  to_port        = var.app_port
}

# Outbound: web port to private app subnets (ALB -> Web)
resource "aws_network_acl_rule" "public_out_web" {
  network_acl_id = aws_network_acl.public.id
  rule_number    = 140
  egress         = true
  protocol       = "tcp"
  rule_action    = "allow"
  cidr_block     = var.vpc_cidr
  from_port      = var.web_port
  to_port        = var.web_port
}

# Outbound: DB port to private data subnets (ECS tasks in public subnets -> RDS)
# Required when enable_nat_gateway=false and tasks run in public subnets.
resource "aws_network_acl_rule" "public_out_db" {
  network_acl_id = aws_network_acl.public.id
  rule_number    = 150
  egress         = true
  protocol       = "tcp"
  rule_action    = "allow"
  cidr_block     = var.vpc_cidr
  from_port      = var.db_port
  to_port        = var.db_port
}

# Public NACL associations
resource "aws_network_acl_association" "public" {
  count          = var.az_count
  subnet_id      = aws_subnet.public[count.index].id
  network_acl_id = aws_network_acl.public.id
}

# ── Private NACL ─────────────────────────────────────────────────────────────
# Applies to private app and private data subnets.
resource "aws_network_acl" "private" {
  vpc_id = aws_vpc.this.id

  tags = merge(local.common_tags, {
    Name = "${var.name}-${var.environment}-nacl-private"
  })
}

# Inbound: app port from VPC (ALB)
resource "aws_network_acl_rule" "private_in_app" {
  network_acl_id = aws_network_acl.private.id
  rule_number    = 100
  egress         = false
  protocol       = "tcp"
  rule_action    = "allow"
  cidr_block     = var.vpc_cidr
  from_port      = var.app_port
  to_port        = var.app_port
}

# Inbound: web port from VPC (ALB)
resource "aws_network_acl_rule" "private_in_web" {
  network_acl_id = aws_network_acl.private.id
  rule_number    = 110
  egress         = false
  protocol       = "tcp"
  rule_action    = "allow"
  cidr_block     = var.vpc_cidr
  from_port      = var.web_port
  to_port        = var.web_port
}

# Inbound: ephemeral (return traffic for outbound requests via NAT)
resource "aws_network_acl_rule" "private_in_ephemeral" {
  network_acl_id = aws_network_acl.private.id
  rule_number    = 120
  egress         = false
  protocol       = "tcp"
  rule_action    = "allow"
  cidr_block     = "0.0.0.0/0"
  from_port      = var.ephemeral_from
  to_port        = var.ephemeral_to
}

# Inbound: DB port from private app subnets (API -> RDS)
resource "aws_network_acl_rule" "private_in_db" {
  network_acl_id = aws_network_acl.private.id
  rule_number    = 130
  egress         = false
  protocol       = "tcp"
  rule_action    = "allow"
  cidr_block     = var.vpc_cidr
  from_port      = var.db_port
  to_port        = var.db_port
}

# Outbound: HTTP via NAT
resource "aws_network_acl_rule" "private_out_http" {
  network_acl_id = aws_network_acl.private.id
  rule_number    = 100
  egress         = true
  protocol       = "tcp"
  rule_action    = "allow"
  cidr_block     = "0.0.0.0/0"
  from_port      = var.http_port
  to_port        = var.http_port
}

# Outbound: HTTPS via NAT
resource "aws_network_acl_rule" "private_out_https" {
  network_acl_id = aws_network_acl.private.id
  rule_number    = 110
  egress         = true
  protocol       = "tcp"
  rule_action    = "allow"
  cidr_block     = "0.0.0.0/0"
  from_port      = var.https_port
  to_port        = var.https_port
}

# Outbound: ephemeral to internet (NAT responses)
resource "aws_network_acl_rule" "private_out_ephemeral" {
  network_acl_id = aws_network_acl.private.id
  rule_number    = 120
  egress         = true
  protocol       = "tcp"
  rule_action    = "allow"
  cidr_block     = "0.0.0.0/0"
  from_port      = var.ephemeral_from
  to_port        = var.ephemeral_to
}

# Outbound: ephemeral to public subnets (return to ALB)
resource "aws_network_acl_rule" "private_out_ephemeral_public" {
  network_acl_id = aws_network_acl.private.id
  rule_number    = 130
  egress         = true
  protocol       = "tcp"
  rule_action    = "allow"
  cidr_block     = var.vpc_cidr
  from_port      = var.ephemeral_from
  to_port        = var.ephemeral_to
}

# Outbound: DB port to private data subnets (API -> RDS)
resource "aws_network_acl_rule" "private_out_db" {
  network_acl_id = aws_network_acl.private.id
  rule_number    = 140
  egress         = true
  protocol       = "tcp"
  rule_action    = "allow"
  cidr_block     = var.vpc_cidr
  from_port      = var.db_port
  to_port        = var.db_port
}

# Private NACL associations for private_app subnets
resource "aws_network_acl_association" "private_app" {
  count          = var.az_count
  subnet_id      = aws_subnet.private_app[count.index].id
  network_acl_id = aws_network_acl.private.id
}

# Private NACL associations for private_data subnets
resource "aws_network_acl_association" "private_data" {
  count          = var.az_count
  subnet_id      = aws_subnet.private_data[count.index].id
  network_acl_id = aws_network_acl.private.id
}
