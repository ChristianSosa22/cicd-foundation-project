# ── Lambda Module — Async Worker Functions ─────────────────────────────────────
# Creates 3 Lambda functions for the async flows:
#   1. receipt-worker: GenerateReceiptCommand → generates PDF receipt, uploads to S3,
#      publishes ReceiptReadyEvent to SNS. VPC-attached (needs RDS + VPC Endpoints).
#   2. release-worker: ReleaseExpiredReservationCommand → UPDATE reservations in RDS.
#      VPC-attached (needs RDS).
#   3. email-worker: ReceiptReadyEvent → sends email via SES. OUTSIDE VPC (needs internet).
#
# The receipt-worker uses a Lambda Layer (pdf-lib + qrcode) for PDF generation.
# All roles are sourced from the IAM module (no inline IAM).
# Event source mappings connect SQS queues to Lambda consumers.
#
# TRADE-OFF (E4 policy relaxation): The receipt-worker reads users.email and
# users.full_name from RDS and includes them in the ReceiptReadyEvent payload.
# This allows the email-worker (outside VPC, needs internet for SES) to send the
# email without needing RDS access. The sensitive data travels encrypted with the
# project CMK via SNS/SQS — only within this AWS account, never over public internet.
# This is a documented relaxation of the E4 security policy.

locals {
  prefix = "${var.project_name}-${var.environment}"
}

# ── Lambda Layer: pdf-lib + qrcode ─────────────────────────────────────────────
# Built locally via null_resource. The layer zip contains node_modules with the
# two dependencies. Rebuilt only when package.json changes (triggers on file hash).
resource "null_resource" "build_receipt_layer" {
  triggers = {
    package_json = filemd5("${path.module}/layer/nodejs/package.json")
  }

  provisioner "local-exec" {
    command = "npm install --prefix ${path.module}/layer/nodejs --omit=dev"
  }
}

data "archive_file" "receipt_layer" {
  type        = "zip"
  source_dir  = "${path.module}/layer"
  output_path = "${path.module}/layer/receipt-layer.zip"
  excludes    = ["nodejs/node_modules/.cache", "receipt-layer.zip"]
}

resource "aws_lambda_layer_version" "receipt" {
  layer_name          = "${local.prefix}-receipt-layer"
  description         = "pdf-lib + qrcode for receipt PDF generation"
  filename            = data.archive_file.receipt_layer.output_path
  source_code_hash    = data.archive_file.receipt_layer.output_base64sha256
  compatible_runtimes = ["nodejs20.x"]
}

# ── Zipped Handlers ───────────────────────────────────────────────────────────
data "archive_file" "receipt" {
  type        = "zip"
  source_file = "${path.module}/handlers/receipt.js"
  output_path = "${path.module}/handlers/receipt.zip"
}

data "archive_file" "release" {
  type        = "zip"
  source_file = "${path.module}/handlers/release.js"
  output_path = "${path.module}/handlers/release.zip"
}

data "archive_file" "email" {
  type        = "zip"
  source_file = "${path.module}/handlers/email.js"
  output_path = "${path.module}/handlers/email.zip"
}

# ── 1. receipt-worker ─────────────────────────────────────────────────────────
# VPC-attached: needs access to RDS (for user/vehicle data) and VPC Endpoints
# (SQS, SNS, SecretsManager, SSM, Logs). Generates receipt PDF using the Layer.
resource "aws_lambda_function" "receipt_worker" {
  function_name    = "${local.prefix}-receipt-worker"
  role             = var.receipt_role_arn
  handler          = "receipt.handler"
  runtime          = "nodejs20.x"
  filename         = data.archive_file.receipt.output_path
  source_code_hash = data.archive_file.receipt.output_base64sha256
  timeout          = 60
  memory_size      = 512
  layers           = [aws_lambda_layer_version.receipt.arn]

  vpc_config {
    subnet_ids         = var.subnet_ids
    security_group_ids = [var.lambda_security_group_id]
  }

  environment {
    variables = {
      S3_BUCKET              = var.receipts_bucket_name
      SNS_TOPIC_ARN          = var.sns_topic_arn
      RECEIPT_QUEUE_URL      = var.receipt_queue_url
      DB_HOST                = var.db_host
      DB_PORT                = tostring(var.db_port)
      DB_NAME                = var.db_name
      DB_USER                = var.db_user
      DB_PASSWORD_SECRET_ARN = var.db_password_secret_arn
      ENCRYPTION_KEY_PARAM   = var.encryption_key_param_name
      HMAC_KEY_PARAM         = var.hmac_key_param_name
    }
  }

  tags = {
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "terraform"
    Service     = "receipt-worker"
  }

  lifecycle {
    ignore_changes = [source_code_hash]
  }
}

resource "aws_cloudwatch_log_group" "receipt_worker" {
  name              = "/aws/lambda/${local.prefix}-receipt-worker"
  retention_in_days = 30

  tags = {
    Environment = var.environment
    Service     = "receipt-worker"
    ManagedBy   = "terraform"
  }
}

resource "aws_lambda_event_source_mapping" "receipt" {
  event_source_arn                   = var.receipt_queue_arn
  function_name                      = aws_lambda_function.receipt_worker.arn
  batch_size                         = var.batch_size
  maximum_batching_window_in_seconds = var.maximum_batching_window
  function_response_types            = ["ReportBatchItemFailures"]
  enabled                            = true

  depends_on = [aws_lambda_function.receipt_worker]
}

# ── 2. release-worker ─────────────────────────────────────────────────────────
# VPC-attached: needs access to RDS for UPDATE reservations.
resource "aws_lambda_function" "release_worker" {
  function_name    = "${local.prefix}-release-worker"
  role             = var.release_role_arn
  handler          = "release.handler"
  runtime          = "nodejs20.x"
  filename         = data.archive_file.release.output_path
  source_code_hash = data.archive_file.release.output_base64sha256
  timeout          = 30
  memory_size      = 256
  layers           = [aws_lambda_layer_version.receipt.arn]

  vpc_config {
    subnet_ids         = var.subnet_ids
    security_group_ids = [var.lambda_security_group_id]
  }

  environment {
    variables = {
      DB_HOST                = var.db_host
      DB_PORT                = tostring(var.db_port)
      DB_NAME                = var.db_name
      DB_USER                = var.db_user
      DB_PASSWORD_SECRET_ARN = var.db_password_secret_arn
    }
  }

  tags = {
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "terraform"
    Service     = "release-worker"
  }

  lifecycle {
    ignore_changes = [source_code_hash]
  }
}

resource "aws_cloudwatch_log_group" "release_worker" {
  name              = "/aws/lambda/${local.prefix}-release-worker"
  retention_in_days = 30

  tags = {
    Environment = var.environment
    Service     = "release-worker"
    ManagedBy   = "terraform"
  }
}

resource "aws_lambda_event_source_mapping" "release" {
  event_source_arn                   = var.release_queue_arn
  function_name                      = aws_lambda_function.release_worker.arn
  batch_size                         = var.batch_size
  maximum_batching_window_in_seconds = var.maximum_batching_window
  function_response_types            = ["ReportBatchItemFailures"]
  enabled                            = true

  depends_on = [aws_lambda_function.release_worker]
}

# ── 3. email-worker ───────────────────────────────────────────────────────────
# OUTSIDE VPC: needs internet access for SES API (no VPCE for SES exists).
# Reads user email from the ReceiptReadyEvent payload (not from DB).
# TRADE-OFF: Slightly relaxes E4 security policy by including user_email and
# user_full_name in the SNS payload. Data travels encrypted within AWS only.
resource "aws_lambda_function" "email_worker" {
  function_name    = "${local.prefix}-email-worker"
  role             = var.email_role_arn
  handler          = "email.handler"
  runtime          = "nodejs20.x"
  filename         = data.archive_file.email.output_path
  source_code_hash = data.archive_file.email.output_base64sha256
  timeout          = 30
  memory_size      = 128

  environment {
    variables = {
      SES_FROM_ADDRESS = var.ses_from_address
      S3_BUCKET        = var.receipts_bucket_name
    }
  }

  tags = {
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "terraform"
    Service     = "email-worker"
  }

  lifecycle {
    ignore_changes = [source_code_hash]
  }
}

resource "aws_cloudwatch_log_group" "email_worker" {
  name              = "/aws/lambda/${local.prefix}-email-worker"
  retention_in_days = 30

  tags = {
    Environment = var.environment
    Service     = "email-worker"
    ManagedBy   = "terraform"
  }
}

resource "aws_lambda_event_source_mapping" "email" {
  event_source_arn                   = var.email_queue_arn
  function_name                      = aws_lambda_function.email_worker.arn
  batch_size                         = var.batch_size
  maximum_batching_window_in_seconds = var.maximum_batching_window
  function_response_types            = ["ReportBatchItemFailures"]
  enabled                            = true

  depends_on = [aws_lambda_function.email_worker]
}
