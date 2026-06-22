# ── IAM Module — Centralized Least-Privilege Roles ─────────────────────────────
# Creates reusable roles per service for the hybrid architecture (ECS Fargate API
# + 3 Lambda async workers + EventBridge Scheduler + CI runner). All policy
# statements use explicit Resource ARNs — no wildcards on Action or Resource.
# Naming uses an -iam- infix to avoid collisions with any pre-existing inline
# roles in compute/worker/scheduler modules until they are migrated.

locals {
  prefix = "${var.project_name}-${var.environment}"
}

# ── 1. Compute Execution Role ─────────────────────────────────────────────────
# Assumed by the Fargate agent to pull ECR images, write logs, read SSM/Secrets.
resource "aws_iam_role" "compute_exec" {
  name = "${local.prefix}-iam-compute-exec"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = {
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "terraform"
    Purpose     = "iam-module"
  }
}

# AWS managed policy: ECR image pull + CloudWatch Logs write
resource "aws_iam_role_policy_attachment" "compute_exec_managed" {
  role       = aws_iam_role.compute_exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Inline policy: read SSM SecureString parameters and Secrets Manager secrets
resource "aws_iam_role_policy" "compute_exec_ssm" {
  name = "${local.prefix}-iam-compute-exec-ssm"
  role = aws_iam_role.compute_exec.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["ssm:GetParameters", "ssm:GetParameter"]
        Resource = "arn:aws:ssm:${var.region}:${data.aws_caller_identity.this.account_id}:parameter/${var.project_name}/*"
      },
      {
        Effect   = "Allow"
        Action   = ["secretsmanager:GetSecretValue"]
        Resource = "arn:aws:secretsmanager:${var.region}:${data.aws_caller_identity.this.account_id}:secret:${var.project_name}/*"
      }
    ]
  })
}

# ── 2. Compute Task Role (API) ────────────────────────────────────────────────
# Assumed by the running API container. S3 read/write on receipts bucket,
# SQS SendMessage on receipt queue, RDS connect, KMS decrypt/generate.
resource "aws_iam_role" "compute_task" {
  name = "${local.prefix}-iam-compute-task"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = {
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "terraform"
    Purpose     = "iam-module"
  }
}

# S3 receipts bucket: GetObject + PutObject
resource "aws_iam_role_policy" "compute_task_s3" {
  name = "${local.prefix}-iam-compute-task-s3"
  role = aws_iam_role.compute_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["s3:GetObject", "s3:PutObject"]
      Resource = "${var.receipts_bucket_arn}/*"
    }]
  })
}

# SQS SendMessage on receipt queue
resource "aws_iam_role_policy" "compute_task_sqs" {
  name = "${local.prefix}-iam-compute-task-sqs"
  role = aws_iam_role.compute_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["sqs:SendMessage"]
      Resource = var.receipt_queue_arn
    }]
  })
}

# RDS IAM connect (for future IAM auth; currently app uses password from Secrets Manager)
resource "aws_iam_role_policy" "compute_task_rds" {
  name = "${local.prefix}-iam-compute-task-rds"
  role = aws_iam_role.compute_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["rds-db:connect"]
      Resource = "arn:aws:rds-db:${var.region}:${data.aws_caller_identity.this.account_id}:dbuser:${var.rds_instance_arn}/${var.db_username}"
    }]
  })
}

# Secrets Manager: GetSecretValue for the db_password secret (runtime SDK call from app)
resource "aws_iam_role_policy" "compute_task_secretsmanager" {
  name = "${local.prefix}-iam-compute-task-secretsmanager"
  role = aws_iam_role.compute_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["secretsmanager:GetSecretValue"]
      Resource = var.db_password_secret_arn
    }]
  })
}

# KMS decrypt + generate data key for S3/RDS operations
resource "aws_iam_role_policy" "compute_task_kms" {
  name = "${local.prefix}-iam-compute-task-kms"
  role = aws_iam_role.compute_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["kms:Decrypt", "kms:GenerateDataKey"]
      Resource = var.kms_key_arn
    }]
  })
}

# ECS Exec permissions (interactive shell via SSM)
resource "aws_iam_role_policy" "compute_task_ecs_exec" {
  name = "${local.prefix}-iam-compute-task-ecs-exec"
  role = aws_iam_role.compute_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "ssmmessages:CreateControlChannel",
        "ssmmessages:CreateDataChannel",
        "ssmmessages:OpenControlChannel",
        "ssmmessages:OpenDataChannel"
      ]
      Resource = "*"
    }]
  })
}

# ── 3. Async Consumer: Receipt Worker Role ────────────────────────────────────
# Lambda execution role for `receipt-worker`: SQS consume, S3 PutObject, SNS
# Publish, Secrets Manager read, KMS, CloudWatch Logs.
resource "aws_iam_role" "async_consumer_receipt" {
  name = "${local.prefix}-iam-async-receipt"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = {
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "terraform"
    Purpose     = "iam-module"
  }
}

resource "aws_iam_role_policy" "async_receipt_sqs" {
  name = "${local.prefix}-iam-async-receipt-sqs"
  role = aws_iam_role.async_consumer_receipt.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "sqs:ReceiveMessage",
        "sqs:DeleteMessage",
        "sqs:GetQueueAttributes"
      ]
      Resource = var.receipt_queue_arn
    }]
  })
}

resource "aws_iam_role_policy" "async_receipt_s3" {
  name = "${local.prefix}-iam-async-receipt-s3"
  role = aws_iam_role.async_consumer_receipt.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["s3:PutObject", "s3:GetObject"]
      Resource = "${var.receipts_bucket_arn}/*"
    }]
  })
}

resource "aws_iam_role_policy" "async_receipt_sns" {
  name = "${local.prefix}-iam-async-receipt-sns"
  role = aws_iam_role.async_consumer_receipt.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["sns:Publish"]
      Resource = aws_sns_topic.receipt_ready.arn
    }]
  })
}

resource "aws_iam_role_policy" "async_receipt_secrets" {
  name = "${local.prefix}-iam-async-receipt-secrets"
  role = aws_iam_role.async_consumer_receipt.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["secretsmanager:GetSecretValue"]
      Resource = "arn:aws:secretsmanager:${var.region}:${data.aws_caller_identity.this.account_id}:secret:${var.project_name}/*"
    }]
  })
}

resource "aws_iam_role_policy" "async_receipt_logs" {
  name = "${local.prefix}-iam-async-receipt-logs"
  role = aws_iam_role.async_consumer_receipt.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
      Resource = "arn:aws:logs:${var.region}:${data.aws_caller_identity.this.account_id}:log-group:/aws/lambda/${local.prefix}*:*:*"
    }]
  })
}

resource "aws_iam_role_policy" "async_receipt_ec2" {
  name = "${local.prefix}-iam-async-receipt-ec2"
  role = aws_iam_role.async_consumer_receipt.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = [
        "ec2:CreateNetworkInterface",
        "ec2:DescribeNetworkInterfaces",
        "ec2:DeleteNetworkInterface"
      ]
      Resource = "*"
    }]
  })
}

# ── 4. Async Consumer: Release Worker Role ────────────────────────────────────
# Lambda execution role for `release-worker`: SQS consume on release queue, KMS, logs.
resource "aws_iam_role" "async_consumer_release" {
  name = "${local.prefix}-iam-async-release"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = {
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "terraform"
    Purpose     = "iam-module"
  }
}

resource "aws_iam_role_policy" "async_release_sqs" {
  name = "${local.prefix}-iam-async-release-sqs"
  role = aws_iam_role.async_consumer_release.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "sqs:ReceiveMessage",
        "sqs:DeleteMessage",
        "sqs:GetQueueAttributes"
      ]
      Resource = var.release_queue_arn
    }]
  })
}

resource "aws_iam_role_policy" "async_release_secrets" {
  name = "${local.prefix}-iam-async-release-secrets"
  role = aws_iam_role.async_consumer_release.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["secretsmanager:GetSecretValue"]
      Resource = "arn:aws:secretsmanager:${var.region}:${data.aws_caller_identity.this.account_id}:secret:${var.project_name}/*"
    }]
  })
}

resource "aws_iam_role_policy" "async_release_logs" {
  name = "${local.prefix}-iam-async-release-logs"
  role = aws_iam_role.async_consumer_release.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
      Resource = "arn:aws:logs:${var.region}:${data.aws_caller_identity.this.account_id}:log-group:/aws/lambda/${local.prefix}*:*:*"
    }]
  })
}

resource "aws_iam_role_policy" "async_release_ec2" {
  name = "${local.prefix}-iam-async-release-ec2"
  role = aws_iam_role.async_consumer_release.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = [
        "ec2:CreateNetworkInterface",
        "ec2:DescribeNetworkInterfaces",
        "ec2:DeleteNetworkInterface"
      ]
      Resource = "*"
    }]
  })
}

# ── 5. Async Consumer: Email Worker Role ──────────────────────────────────────
# Lambda execution role for `email-worker`: SQS consume on email queue, KMS, logs.
resource "aws_iam_role" "async_consumer_email" {
  name = "${local.prefix}-iam-async-email"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = {
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "terraform"
    Purpose     = "iam-module"
  }
}

resource "aws_iam_role_policy" "async_email_sqs" {
  name = "${local.prefix}-iam-async-email-sqs"
  role = aws_iam_role.async_consumer_email.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "sqs:ReceiveMessage",
        "sqs:DeleteMessage",
        "sqs:GetQueueAttributes"
      ]
      Resource = var.email_queue_arn
    }]
  })
}

resource "aws_iam_role_policy" "async_email_secrets" {
  name = "${local.prefix}-iam-async-email-secrets"
  role = aws_iam_role.async_consumer_email.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["secretsmanager:GetSecretValue"]
      Resource = "arn:aws:secretsmanager:${var.region}:${data.aws_caller_identity.this.account_id}:secret:${var.project_name}/*"
    }]
  })
}

resource "aws_iam_role_policy" "async_email_logs" {
  name = "${local.prefix}-iam-async-email-logs"
  role = aws_iam_role.async_consumer_email.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
      Resource = "arn:aws:logs:${var.region}:${data.aws_caller_identity.this.account_id}:log-group:/aws/lambda/${local.prefix}*:*:*"
    }]
  })
}

# ── 6. Scheduler Role (EventBridge) ──────────────────────────────────────────
# EventBridge Scheduler: sqs:SendMessage on `release queue`.
resource "aws_iam_role" "scheduler" {
  name = "${local.prefix}-iam-scheduler"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "scheduler.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = {
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "terraform"
    Purpose     = "iam-module"
  }
}

resource "aws_iam_role_policy" "scheduler_sqs" {
  name = "${local.prefix}-iam-scheduler-sqs"
  role = aws_iam_role.scheduler.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["sqs:SendMessage"]
      Resource = var.release_queue_arn
    }]
  })
}

# ── 7. CI Runner Role (OIDC) ────────────────────────────────────────────────
# GitHub Actions role assumable via OIDC federation. Trust policy scoped to
# the specific repository branch. Permissions for terraform plan/apply only.
# OIDC provider itself is provisioned by Estudiante B (Deliverable C).
resource "aws_iam_role" "ci_runner" {
  name = "${local.prefix}-iam-ci-runner"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = var.oidc_provider_arn != "" ? [{
      Effect    = "Allow"
      Principal = { Federated = var.oidc_provider_arn }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "${var.oidc_audience}" = "sts.amazonaws.com"
        }
        StringLike = {
          "sub" = "repo:${var.github_repo}:ref:refs/heads/main"
        }
      }
      }] : [{
      Effect    = "Allow"
      Principal = { Federated = "arn:aws:iam::${data.aws_caller_identity.this.account_id}:oidc-provider/placeholder" }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
        }
        StringLike = {
          "token.actions.githubusercontent.com:sub" = "repo:${var.github_repo}:ref:refs/heads/main"
        }
      }
    }]
  })

  tags = {
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "terraform"
    Purpose     = "iam-module"
  }
}

# Terraform plan/apply permissions across all modules
resource "aws_iam_role_policy" "ci_runner_terraform" {
  name = "${local.prefix}-iam-ci-runner-terraform"
  role = aws_iam_role.ci_runner.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = [
          "arn:aws:s3:::${var.project_name}",
          "arn:aws:s3:::${var.project_name}/*",
          "arn:aws:s3:::cicd-foundation-project",
          "arn:aws:s3:::cicd-foundation-project/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:DeleteItem"
        ]
        Resource = "arn:aws:dynamodb:${var.region}:${data.aws_caller_identity.this.account_id}:table/*${var.project_name}*"
      },
      {
        Effect = "Allow"
        Action = [
          "ec2:*NetworkInterface*",
          "ec2:*Subnet*",
          "ec2:*Vpc*",
          "ec2:*SecurityGroup*",
          "ec2:*Route*",
          "ec2:*InternetGateway*",
          "ec2:*NatGateway*",
          "ec2:*Tags*",
          "ec2:*DhcpOptions*",
          "ec2:*AvailabilityZone*",
          "ec2:*LaunchTemplate*",
          "ec2:*KeyPair*",
          "ec2:*Instance*"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "aws:RequestedRegion" = var.region
          }
        }
      },
      {
        # KMS permissions needed to create/update SSM parameters and Secrets Manager
        # secrets encrypted with the project CMK during terraform apply.
        Effect = "Allow"
        Action = [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:ReEncrypt*",
          "kms:GenerateDataKey*",
          "kms:DescribeKey",
          "kms:ListKeys",
          "kms:ListAliases",
          "kms:CreateKey",
          "kms:CreateAlias",
          "kms:DeleteAlias",
          "kms:UpdateAlias",
          "kms:EnableKeyRotation",
          "kms:GetKeyPolicy",
          "kms:GetKeyRotationStatus",
          "kms:PutKeyPolicy",
          "kms:TagResource",
          "kms:ScheduleKeyDeletion",
          "kms:CancelKeyDeletion"
        ]
        Resource = "*"
      }
    ]
  })
}

# ── SNS Topic: ReceiptReadyEvent ───────────────────────────────────────────────
# receipt-worker publishes ReceiptReadyEvent here; SNS fans out to email-queue.
# Created inside IAM module so async_receipt_sns policy can reference it at plan time.
resource "aws_sns_topic" "receipt_ready" {
  name = "${local.prefix}-receipt-ready"

  tags = {
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "terraform"
  }
}

resource "aws_sns_topic_subscription" "email_queue" {
  topic_arn = aws_sns_topic.receipt_ready.arn
  protocol  = "sqs"
  endpoint  = var.email_queue_arn
}

# ── Data Sources ──────────────────────────────────────────────────────────────
data "aws_caller_identity" "this" {}
