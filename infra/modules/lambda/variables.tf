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
  description = "ARN of the receipt-worker Lambda execution role from the IAM module. Grants SQS consume, S3 put, SNS publish, and logs."
  type        = string
}

variable "release_role_arn" {
  description = "ARN of the release-worker Lambda execution role from the IAM module. Grants SQS consume, Secrets Manager, and logs."
  type        = string
}

variable "email_role_arn" {
  description = "ARN of the email-worker Lambda execution role from the IAM module. Grants SQS consume, Secrets Manager, and logs."
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

# ── S3 Bucket (from storage module) ──────────────────────────────────────────

variable "receipts_bucket_arn" {
  description = "ARN of the S3 receipts bucket. Used by receipt-worker to store receipt objects."
  type        = string
}

variable "receipts_bucket_name" {
  description = "Name of the S3 receipts bucket. Passed as S3_BUCKET env var to receipt-worker."
  type        = string
}

# ── VPC Config (for receipt-worker and release-worker) ────────────────────────

variable "subnet_ids" {
  description = "List of private subnet IDs where VPC-attached Lambda functions are deployed. Used by receipt-worker and release-worker."
  type        = list(string)
}

variable "security_group_id" {
  description = "Security group ID for VPC-attached Lambda functions. Must allow outbound traffic to RDS, S3, and SQS."
  type        = string
}

# ── Event Source Mapping Config ───────────────────────────────────────────────

variable "batch_size" {
  description = "Maximum number of SQS messages delivered per Lambda invocation. Range 1-10 for SQS. Higher values reduce function invocations but increase processing time per batch."
  type        = number
  default     = 10
}

variable "maximum_batching_window" {
  description = "Maximum amount of time (in seconds) to gather messages before invoking the Lambda function. 0 means no batching (process immediately)."
  type        = number
  default     = 0
}
