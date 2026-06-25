# ── Full KMS Key Policy ───────────────────────────────────────────────────────
# Applied after all IAM roles exist to avoid MalformedPolicyDocumentException
# on fresh environment deploys (role ARN principals are validated by AWS at
# policy-write time, so they must exist before this resource is created).
#
# The KMS key itself is created with a bootstrap policy (root account only) via
# modules/kms/main.tf. This resource overwrites it with the full set of grants.
# modules/kms/main.tf carries `lifecycle { ignore_changes = [policy] }` so
# Terraform does not fight this standalone resource on subsequent plans.

data "aws_caller_identity" "root" {}
data "aws_region" "root" {}

resource "aws_kms_key_policy" "main" {
  key_id = module.kms.key_id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        # Allows IAM policies in this account to delegate KMS usage to users and roles.
        Sid    = "EnableIAMUserPermissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.root.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        # Key administration — rotation, disable, schedule deletion, grants.
        Sid    = "KeyAdministration"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.root.account_id}:root"
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
        # Cryptographic usage for ECS Fargate: execution role (image pull + secrets),
        # task role (API runtime), and the async worker task role (SQS consumer).
        Sid    = "ComputeRoleUsage"
        Effect = "Allow"
        Principal = {
          AWS = [
            module.iam.compute_exec_role_arn,
            module.iam.compute_task_role_arn,
            module.compute.worker_task_role_arn,
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
            "kms:CallerAccount" = data.aws_caller_identity.root.account_id
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
            "kms:CallerAccount" = data.aws_caller_identity.root.account_id
          }
        }
      },
      {
        # CI runner (OIDC role, created by infra/bootstrap/oidc.tf) needs
        # encrypt/decrypt to create and update SSM parameters and Secrets Manager
        # secrets encrypted with this CMK during terraform apply.
        Sid    = "CIRunnerUsage"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.root.account_id}:role/gha-deploy-${var.environment}"
        }
        Action = [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:ReEncrypt*",
          "kms:GenerateDataKey*",
          "kms:DescribeKey"
        ]
        Resource = "*"
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
            "kms:CallerAccount" = data.aws_caller_identity.root.account_id
          }
        }
      }
    ]
  })

  depends_on = [module.iam, module.compute]
}
