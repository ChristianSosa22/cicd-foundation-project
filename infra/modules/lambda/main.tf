# ── Lambda Module — Async Worker Functions ─────────────────────────────────────
# Creates 3 Lambda functions for the async flows:
#   1. receipt-worker: GenerateReceiptCommand → S3 receipt object
#   2. release-worker: ReleaseExpiredReservationCommand → DB update
#   3. email-worker: ReceiptReadyEvent → email notification
# All roles are sourced from the IAM module (no inline IAM).
# Event source mappings connect SQS queues to Lambda consumers.

locals {
  prefix = "${var.project_name}-${var.environment}"
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
# Consumes from receipt SQS queue. Generates receipt object in S3.
# VPC-attached: needs access to RDS (for future DB queries).
resource "aws_lambda_function" "receipt_worker" {
  function_name    = "${local.prefix}-receipt-worker"
  role             = var.receipt_role_arn
  handler          = "receipt.handler"
  runtime          = "nodejs20.x"
  filename         = data.archive_file.receipt.output_path
  source_code_hash = data.archive_file.receipt.output_base64sha256
  timeout          = 30
  memory_size      = 256

  vpc_config {
    subnet_ids         = var.subnet_ids
    security_group_ids = [var.security_group_id]
  }

  environment {
    variables = {
      S3_BUCKET = var.receipts_bucket_name
    }
  }

  tags = {
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "terraform"
    Service     = "receipt-worker"
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
# Consumes from release SQS queue (EventBridge Scheduler → SQS).
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

  vpc_config {
    subnet_ids         = var.subnet_ids
    security_group_ids = [var.security_group_id]
  }

  environment {
    variables = {}
  }

  tags = {
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "terraform"
    Service     = "release-worker"
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
# Consumes from email SQS queue (SNS ReceiptReadyEvent → SQS fan-out).
# NOT VPC-attached: needs internet access for email sending (no RDS needed).
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
    variables = {}
  }

  tags = {
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "terraform"
    Service     = "email-worker"
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
