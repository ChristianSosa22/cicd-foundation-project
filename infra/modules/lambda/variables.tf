variable "project_name" {
  description = "Project name prefix. Used in Lambda function names and resource tags."
  type        = string
}

variable "environment" {
  description = "Deployment environment name (e.g., dev, staging, prod). Used in resource names and tags."
  type        = string
}

# ── IAM Role ARNs (from IAM module) ──────────────────────────────────────────

variable "receipt_role_arn" {
  description = "ARN of the receipt-worker Lambda execution role from the IAM module. Grants SQS consume, S3 put, SNS publish, SecretsManager read, SSM read, and logs."
  type        = string
}

variable "release_role_arn" {
  description = "ARN of the release-worker Lambda execution role from the IAM module. Grants SQS consume, SecretsManager read, and logs."
  type        = string
}

variable "email_role_arn" {
  description = "ARN of the email-worker Lambda execution role from the IAM module. Grants SQS consume, SES send, S3 get, KMS decrypt, and logs."
  type        = string
}

# ── SQS Queue ARNs (from async module) ───────────────────────────────────────

variable "receipt_queue_arn" {
  description = "ARN of the receipt SQS queue. receipt-worker polls from this queue via event source mapping."
  type        = string
}

variable "release_queue_arn" {
  description = "ARN of the release SQS queue. release-worker polls from this queue via event source mapping."
  type        = string
}

variable "email_queue_arn" {
  description = "ARN of the email SQS queue. email-worker polls from this queue via event source mapping."
  type        = string
}

# ── SQS Queue URLs (for sending delete/ack within handlers) ──────────────────

variable "receipt_queue_url" {
  description = "URL of the receipt SQS queue. Used by receipt-worker to delete processed messages."
  type        = string
}

# ── S3 Bucket (from storage module) ──────────────────────────────────────────

variable "receipts_bucket_arn" {
  description = "ARN of the S3 receipts bucket. Used by receipt-worker to store receipt objects."
  type        = string
}

variable "receipts_bucket_name" {
  description = "Name of the S3 receipts bucket. Passed as S3_BUCKET env var to receipt-worker and email-worker."
  type        = string
}

# ── SNS Topic (from IAM module) ──────────────────────────────────────────────

variable "sns_topic_arn" {
  description = "ARN of the SNS receipt-ready topic. receipt-worker publishes ReceiptReadyEvent here."
  type        = string
}

# ── VPC Config (for receipt-worker and release-worker) ────────────────────────

variable "subnet_ids" {
  description = "List of private subnet IDs where VPC-attached Lambda functions are deployed."
  type        = list(string)
}

variable "lambda_security_group_id" {
  description = "Security group ID for VPC-attached Lambda functions (receipt/release workers). Must allow egress to RDS and VPC Endpoints."
  type        = string
}

# ── Database connection (passed as env vars to Lambda) ────────────────────────

variable "db_host" {
  description = "RDS endpoint hostname. Passed as DB_HOST env var to Lambda functions."
  type        = string
}

variable "db_port" {
  description = "RDS port. Passed as DB_PORT env var to Lambda functions."
  type        = number
  default     = 5432
}

variable "db_name" {
  description = "PostgreSQL database name. Passed as DB_NAME env var to Lambda functions."
  type        = string
}

variable "db_user" {
  description = "PostgreSQL database username. Passed as DB_USER env var to Lambda functions."
  type        = string
}

variable "db_password_secret_arn" {
  description = "ARN of the Secrets Manager secret containing the RDS password. Passed as DB_PASSWORD_SECRET_ARN env var."
  type        = string
}

# ── SSM Parameter names (for ENCRYPTION_KEY and HMAC_KEY) ────────────────────

variable "encryption_key_param_name" {
  description = "Full SSM parameter name for the AES-256-GCM encryption key. Used by receipt-worker to decrypt plate_enc."
  type        = string
}

variable "hmac_key_param_name" {
  description = "Full SSM parameter name for the HMAC-SHA256 key. Used by receipt-worker for plate hashing."
  type        = string
}

# ── SES (for email-worker) ───────────────────────────────────────────────────

variable "ses_from_address" {
  description = "Sender email address for SES. Must be verified in SES sandbox."
  type        = string
}

# ── Event Source Mapping Config ───────────────────────────────────────────────

variable "batch_size" {
  description = "Maximum number of SQS messages delivered per Lambda invocation. Range 1-10 for SQS."
  type        = number
  default     = 10
}

variable "maximum_batching_window" {
  description = "Maximum time in seconds to gather messages before invoking Lambda. 0 = process immediately."
  type        = number
  default     = 0
}
