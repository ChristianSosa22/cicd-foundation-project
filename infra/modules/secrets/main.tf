# SSM Parameter Store — runtime secrets for ECS tasks.
#
# PATTERN A: Terraform owns the parameter resource, its path, its IAM binding, and the
# ECS 'secrets' wiring. It does NOT own the secret value. Each parameter is initialized
# with a placeholder and lifecycle { ignore_changes = [value] } so Terraform never
# overwrites a value that was set out-of-band.
#
# After 'terraform apply', populate real values once via the AWS CLI:
#
#   aws ssm put-parameter \
#     --name "/oyd-project/dev/DATABASE_URL" \
#     --type SecureString \
#     --value "postgres://parking_user:PASS@HOST:5432/parking" \
#     --overwrite
#
#   aws ssm put-parameter --name "/oyd-project/dev/JWT_SECRET"     --type SecureString --value "<≥16 chars>"     --overwrite
#   aws ssm put-parameter --name "/oyd-project/dev/ENCRYPTION_KEY" --type SecureString --value "<base64 32 bytes>" --overwrite
#   aws ssm put-parameter --name "/oyd-project/dev/HMAC_KEY"       --type SecureString --value "<random string>"  --overwrite
#
# The ECS task execution role is granted ssm:GetParameters on these ARNs so the
# Fargate agent can inject the values at container start without ever writing them
# to the task definition or Terraform state.

locals {
  path_prefix = "/${var.name}/${var.environment}"
  kms_key     = var.kms_key_id != "" ? var.kms_key_id : null
}

# ── Secrets Manager — DB password ─────────────────────────────────────────────
# Stores the RDS master password as a Secrets Manager secret so the value is
# never hardcoded in Terraform state as plaintext. The secret version is owned
# by Terraform and its value flows in from the sensitive variable db_password,
# which must be supplied via TF_VAR_db_password or a CI secret at apply time.
resource "aws_secretsmanager_secret" "db_password" {
  name        = "${local.path_prefix}/db_password"
  description = "RDS master password for ${var.name}-${var.environment}. Managed by Terraform; value sourced from TF_VAR_db_password."
  kms_key_id  = local.kms_key

  tags = {
    Environment = var.environment
    Project     = var.name
    ManagedBy   = "terraform"
  }
}

resource "aws_secretsmanager_secret_version" "db_password" {
  secret_id     = aws_secretsmanager_secret.db_password.id
  secret_string = var.db_password != "" ? var.db_password : "PLACEHOLDER_SET_ON_INITIAL_APPLY"

  # After the first apply seeds the real password, subsequent pipeline runs do
  # not pass TF_VAR_db_password. ignore_changes ensures Terraform never
  # overwrites the live value — the secret is managed out-of-band from that
  # point on, just like the SSM parameters above.
  lifecycle {
    ignore_changes = [secret_string]
  }
}

# Full PostgreSQL connection string consumed by the API as DATABASE_URL.
# Format: postgres://username:password@host:5432/parking
resource "aws_ssm_parameter" "database_url" {
  name        = "${local.path_prefix}/DATABASE_URL"
  description = "Full PostgreSQL connection string for the parking API. Assemble after RDS is provisioned: postgres://user:pass@rds-endpoint:5432/parking."
  type        = "SecureString"
  value       = "PLACEHOLDER_SET_OUT_OF_BAND"
  key_id      = local.kms_key

  lifecycle {
    ignore_changes = [value]
  }

  tags = {
    Environment = var.environment
    Project     = var.name
    ManagedBy   = "terraform"
  }
}

# JWT signing secret — must be at least 16 characters. Rotate periodically.
resource "aws_ssm_parameter" "jwt_secret" {
  name        = "${local.path_prefix}/JWT_SECRET"
  description = "Secret key used to sign and verify JWT tokens. Minimum 16 characters. Rotate periodically."
  type        = "SecureString"
  value       = "PLACEHOLDER_SET_OUT_OF_BAND"
  key_id      = local.kms_key

  lifecycle {
    ignore_changes = [value]
  }

  tags = {
    Environment = var.environment
    Project     = var.name
    ManagedBy   = "terraform"
  }
}

# AES-256-GCM column encryption key for plate numbers and phone numbers.
# Generate with: openssl rand -base64 32
resource "aws_ssm_parameter" "encryption_key" {
  name        = "${local.path_prefix}/ENCRYPTION_KEY"
  description = "Base64-encoded 32-byte AES-256-GCM key for encrypting sensitive columns (plate, phone). Generate: openssl rand -base64 32."
  type        = "SecureString"
  value       = "PLACEHOLDER_SET_OUT_OF_BAND"
  key_id      = local.kms_key

  lifecycle {
    ignore_changes = [value]
  }

  tags = {
    Environment = var.environment
    Project     = var.name
    ManagedBy   = "terraform"
  }
}

# HMAC-SHA256 key for deterministic plate hashing (allows unique lookups without decryption).
resource "aws_ssm_parameter" "hmac_key" {
  name        = "${local.path_prefix}/HMAC_KEY"
  description = "HMAC-SHA256 key for deterministic plate hashing. Enables unique-lookup queries without decrypting the encrypted column."
  type        = "SecureString"
  value       = "PLACEHOLDER_SET_OUT_OF_BAND"
  key_id      = local.kms_key

  lifecycle {
    ignore_changes = [value]
  }

  tags = {
    Environment = var.environment
    Project     = var.name
    ManagedBy   = "terraform"
  }
}
