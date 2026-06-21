data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
  prefix            = "${var.project_name}-${var.environment}"
  account_id        = data.aws_caller_identity.current.account_id
  compute_exec_arn  = "arn:aws:iam::${local.account_id}:role/${local.prefix}-iam-compute-exec"
  compute_task_arn  = "arn:aws:iam::${local.account_id}:role/${local.prefix}-iam-compute-task"
}

resource "aws_kms_key" "main" {
  description             = "CMK for ${local.prefix}: encrypts S3 and RDS"
  deletion_window_in_days = var.key_deletion_window_in_days
  enable_key_rotation     = true

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        # Key administration only — no cryptographic usage actions.
        # Root can rotate, disable, schedule deletion, and manage grants,
        # but cannot use the key for encrypt/decrypt operations directly.
        Sid    = "KeyAdministration"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${local.account_id}:root"
        }
        Action = [
          "kms:Create*",
          "kms:Describe*",
          "kms:Enable*",
          "kms:List*",
          "kms:Put*",
          "kms:Update*",
          "kms:Revoke*",
          "kms:Disable*",
          "kms:Get*",
          "kms:Delete*",
          "kms:ScheduleKeyDeletion",
          "kms:CancelKeyDeletion",
          "kms:TagResource",
          "kms:UntagResource"
        ]
        Resource = "*"
      },
      {
        # Cryptographic usage restricted to the ECS execution role
        # (pulls secrets at container start) and the ECS task role (app runtime).
        Sid    = "ComputeRoleUsage"
        Effect = "Allow"
        Principal = {
          AWS = [
            local.compute_exec_arn,
            local.compute_task_arn
          ]
        }
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey",
          "kms:DescribeKey"
        ]
        Resource = "*"
      },
      {
        # Secrets Manager service principal: decrypt secrets encrypted with this CMK.
        Sid    = "SecretsManagerUsage"
        Effect = "Allow"
        Principal = {
          Service = "secretsmanager.amazonaws.com"
        }
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey",
          "kms:DescribeKey"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "kms:CallerAccount" = local.account_id
          }
        }
      },
      {
        # RDS service principal: encrypt/decrypt storage and automated backups.
        Sid    = "RDSServiceUsage"
        Effect = "Allow"
        Principal = {
          Service = "rds.amazonaws.com"
        }
        Action = [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:ReEncrypt*",
          "kms:GenerateDataKey*",
          "kms:DescribeKey",
          "kms:CreateGrant"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "kms:CallerAccount" = local.account_id
          }
        }
      },
      {
        # S3 service principal: generate data keys for SSE-KMS object encryption.
        Sid    = "S3ServiceUsage"
        Effect = "Allow"
        Principal = {
          Service = "s3.amazonaws.com"
        }
        Action = [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:ReEncrypt*",
          "kms:GenerateDataKey*",
          "kms:DescribeKey"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "kms:CallerAccount" = local.account_id
          }
        }
      }
    ]
  })

  tags = {
    Name        = var.kms_key_alias
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "terraform"
  }
}

resource "aws_kms_alias" "main" {
  name          = "alias/${var.kms_key_alias}"
  target_key_id = aws_kms_key.main.key_id
}
