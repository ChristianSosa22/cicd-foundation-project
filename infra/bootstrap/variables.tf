variable "region" {
  type        = string
  description = "AWS region for the remote state backend resources."
  default     = "us-east-1"
}

variable "state_bucket_name" {
  type        = string
  description = "Globally unique name of the S3 bucket that will store Terraform remote state."
}

variable "lock_table_name" {
  type        = string
  description = "Name of the DynamoDB table used for Terraform state locking. Must have a string hash key named LockID."
}
