# RDS PostgreSQL — private, encrypted, scoped to the custom VPC.
# Security group (db-sg) is managed by the security module.
resource "aws_db_subnet_group" "default" {
  name       = "${var.project_name}-${var.environment}-db-subnet-group"
  subnet_ids = var.subnet_ids

  tags = {
    Name        = "${var.project_name}-${var.environment}-db-subnet-group"
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "terraform"
  }
}

resource "aws_db_parameter_group" "default" {
  name   = "${var.project_name}-${var.environment}-db-pg"
  family = "postgres${split(".", var.db_engine_version)[0]}"

  parameter {
    name         = "max_connections"
    value        = var.db_max_connections
    apply_method = "pending-reboot"
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-db-pg"
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "terraform"
  }
}

resource "aws_db_instance" "default" {
  identifier        = "${var.project_name}-${var.environment}-db"
  engine            = "postgres"
  engine_version    = var.db_engine_version # was hardcoded "16.14"; now uses var
  instance_class    = var.db_instance_class
  allocated_storage = var.db_allocated_storage

  db_name  = var.db_name
  username = var.db_username
  password = var.db_password
  port     = var.db_port

  multi_az               = var.multi_az
  storage_encrypted      = true
  kms_key_id             = var.kms_key_arn
  publicly_accessible    = false
  db_subnet_group_name   = aws_db_subnet_group.default.name
  vpc_security_group_ids = [var.db_security_group_id]
  parameter_group_name   = aws_db_parameter_group.default.name

  skip_final_snapshot = var.skip_final_snapshot
  deletion_protection = var.deletion_protection

  lifecycle {
    ignore_changes = [password]
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-db"
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "terraform"
  }
}
