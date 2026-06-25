data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
  account_id = data.aws_caller_identity.current.account_id
}

resource "aws_kms_key" "main" {
  description             = "CMK for ${var.project_name}-${var.environment}: encrypts S3 and RDS"
  deletion_window_in_days = var.key_deletion_window_in_days
  enable_key_rotation     = true

  # Bootstrap policy: only always-valid principals (root account + AWS service principals).
  # Role-based grants (compute, CI runner) are applied after those roles exist via
  # aws_kms_key_policy in the root module, which avoids MalformedPolicyDocumentException
  # on a fresh apply when the IAM roles don't exist yet.
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        # Allows IAM policies in this account to delegate KMS usage to users and roles.
        # Without this statement, the key policy is the only access control layer.
        Sid    = "EnableIAMUserPermissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${local.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        # Key administration only — no cryptographic usage actions.
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

  # Prevent Terraform from fighting the standalone aws_kms_key_policy (root module)
  # which overwrites this policy with the full set of principals after roles exist.
  lifecycle {
    ignore_changes = [policy]
  }

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
