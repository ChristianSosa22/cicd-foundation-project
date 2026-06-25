resource "aws_security_group" "web" {
  name        = "${var.name}-${var.environment}-web-sg"
  description = "Web/ALB tier: HTTP/HTTPS from internet, egress to app tier"
  vpc_id      = var.vpc_id

  tags = {
    Name        = "${var.name}-${var.environment}-web-sg"
    Environment = var.environment
    Project     = var.name
    ManagedBy   = "terraform"
  }
}

resource "aws_security_group" "app" {
  name        = "${var.name}-${var.environment}-app-sg"
  description = "App tier: ingress from web-sg on app port, egress to db-sg"
  vpc_id      = var.vpc_id

  tags = {
    Name        = "${var.name}-${var.environment}-app-sg"
    Environment = var.environment
    Project     = var.name
    ManagedBy   = "terraform"
  }
}

resource "aws_security_group" "web_service" {
  name        = "${var.name}-${var.environment}-web-service-sg"
  description = "Web service tier: ingress from web-sg on web port, egress to app-sg"
  vpc_id      = var.vpc_id

  tags = {
    Name        = "${var.name}-${var.environment}-web-service-sg"
    Environment = var.environment
    Project     = var.name
    ManagedBy   = "terraform"
  }
}

resource "aws_security_group" "db" {
  name        = "${var.name}-${var.environment}-db-sg"
  description = "DB tier: PostgreSQL ingress from app-sg only. No internet egress."
  vpc_id      = var.vpc_id

  tags = {
    Name        = "${var.name}-${var.environment}-db-sg"
    Environment = var.environment
    Project     = var.name
    ManagedBy   = "terraform"
  }
}

resource "aws_security_group_rule" "web_ingress_http" {
  type              = "ingress"
  security_group_id = aws_security_group.web.id
  from_port         = var.http_port
  to_port           = var.http_port
  protocol          = "tcp"
  cidr_blocks       = var.allowed_ingress_cidrs
  description       = "HTTP from internet"
}

resource "aws_security_group_rule" "web_ingress_https" {
  type              = "ingress"
  security_group_id = aws_security_group.web.id
  from_port         = var.https_port
  to_port           = var.https_port
  protocol          = "tcp"
  cidr_blocks       = var.allowed_ingress_cidrs
  description       = "HTTPS from internet"
}

resource "aws_security_group_rule" "web_egress_app" {
  type                     = "egress"
  security_group_id        = aws_security_group.web.id
  from_port                = var.app_port
  to_port                  = var.app_port
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.app.id
  description              = "Egress to API on app port"
}

resource "aws_security_group_rule" "web_egress_web_service" {
  type                     = "egress"
  security_group_id        = aws_security_group.web.id
  from_port                = var.web_port
  to_port                  = var.web_port
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.web_service.id
  description              = "Egress to web service on web port"
}

resource "aws_security_group_rule" "app_ingress_from_web" {
  type                     = "ingress"
  security_group_id        = aws_security_group.app.id
  from_port                = var.app_port
  to_port                  = var.app_port
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.web.id
  description              = "Ingress from web-sg on app port"
}

resource "aws_security_group_rule" "app_ingress_from_web_service" {
  type                     = "ingress"
  security_group_id        = aws_security_group.app.id
  from_port                = var.app_port
  to_port                  = var.app_port
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.web_service.id
  description              = "Ingress from web service on app port"
}

resource "aws_security_group_rule" "app_egress_db" {
  type                     = "egress"
  security_group_id        = aws_security_group.app.id
  from_port                = var.db_port
  to_port                  = var.db_port
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.db.id
  description              = "Egress to RDS on DB port"
}

resource "aws_security_group_rule" "app_egress_internet" {
  type              = "egress"
  security_group_id = aws_security_group.app.id
  from_port         = 0
  to_port           = 0
  protocol          = "-1"
  cidr_blocks       = ["0.0.0.0/0"]
  description       = "All outbound: ECR pull, CloudWatch, S3 via NAT"
}

resource "aws_security_group_rule" "web_service_ingress_from_web" {
  type                     = "ingress"
  security_group_id        = aws_security_group.web_service.id
  from_port                = var.web_port
  to_port                  = var.web_port
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.web.id
  description              = "Ingress from web-sg on web port"
}

resource "aws_security_group_rule" "web_service_egress_app" {
  type                     = "egress"
  security_group_id        = aws_security_group.web_service.id
  from_port                = var.app_port
  to_port                  = var.app_port
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.app.id
  description              = "Egress to API on app port for internal calls"
}

resource "aws_security_group_rule" "web_service_egress_internet" {
  type              = "egress"
  security_group_id = aws_security_group.web_service.id
  from_port         = 0
  to_port           = 0
  protocol          = "-1"
  cidr_blocks       = ["0.0.0.0/0"]
  description       = "All outbound: ECR pull, CloudWatch, S3 via NAT"
}

resource "aws_security_group_rule" "db_ingress_from_app" {
  type                     = "ingress"
  security_group_id        = aws_security_group.db.id
  from_port                = var.db_port
  to_port                  = var.db_port
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.app.id
  description              = "Ingress from app-sg on DB port"
}

# ── 6. SECURITY GROUP: sg-parking-lambda ────────────────────────────────────────
# Attached to receipt-worker and release-worker Lambdas (VPC-attached).
# email-worker stays outside VPC (needs internet for SES — no VPCE available).
resource "aws_security_group" "lambda" {
  name        = "${var.name}-${var.environment}-lambda-sg"
  description = "Lambda tier: egress to RDS on DB port + VPC Endpoints on 443"
  vpc_id      = var.vpc_id

  tags = {
    Name        = "${var.name}-${var.environment}-lambda-sg"
    Environment = var.environment
    Project     = var.name
    ManagedBy   = "terraform"
  }
}

resource "aws_security_group_rule" "lambda_egress_db" {
  type                     = "egress"
  security_group_id        = aws_security_group.lambda.id
  from_port                = var.db_port
  to_port                  = var.db_port
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.db.id
  description              = "Egress to RDS on DB port"
}

resource "aws_security_group_rule" "lambda_egress_vpce" {
  type                     = "egress"
  security_group_id        = aws_security_group.lambda.id
  from_port                = var.https_port
  to_port                  = var.https_port
  protocol                 = "tcp"
  source_security_group_id = var.vpce_security_group_id
  description              = "Egress to VPC Endpoints (SQS, SNS, SecretsManager, SSM, Logs) on 443"
}

# S3 Gateway endpoint uses prefix lists, not security groups — Lambda needs explicit
# egress to the regional S3 prefix list so receipt-worker can upload PDF receipts.
data "aws_prefix_list" "s3" {
  name = "com.amazonaws.${var.region}.s3"
}

resource "aws_security_group_rule" "lambda_egress_s3" {
  type              = "egress"
  security_group_id = aws_security_group.lambda.id
  from_port         = var.https_port
  to_port           = var.https_port
  protocol          = "tcp"
  prefix_list_ids   = [data.aws_prefix_list.s3.id]
  description       = "Egress to S3 Gateway Endpoint via prefix list"
}

# DB SG: allow ingress from lambda SG (receipt/release workers need RDS)
resource "aws_security_group_rule" "db_ingress_from_lambda" {
  type                     = "ingress"
  security_group_id        = aws_security_group.db.id
  from_port                = var.db_port
  to_port                  = var.db_port
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.lambda.id
  description              = "Ingress from lambda-sg on DB port"
}
