variable "name" {
  description = "Project name used as the base of the bucket name. Final name: <name>-receipts-<environment>."
  type        = string
}

variable "environment" {
  description = "Deployment environment name (e.g., dev, staging, prod). Appended to the bucket name as a suffix."
  type        = string
}

variable "kms_key_arn" {
  description = "ARN of the KMS CMK used for S3 server-side encryption (aws:kms). Must be in the same region as the bucket."
  type        = string
}
