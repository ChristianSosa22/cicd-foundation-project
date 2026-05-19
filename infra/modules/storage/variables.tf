variable "environment" {
  description = "Deployment environment name (e.g., dev, staging, prod). Used as a suffix in the bucket name."
  type        = string
}

variable "bucket_name" {
  description = "Base name for the S3 bucket. Combined with the environment to form the final bucket name."
  type        = string
}