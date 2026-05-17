output "bucket_name" {
  description = "Name of the S3 bucket provisioned by this workspace. Use this for s3:// URIs and most CLI/API operations."
  value       = aws_s3_bucket.this.bucket
}

output "bucket_arn" {
  description = "ARN of the S3 bucket. Use this when granting access to the bucket from IAM policies."
  value       = aws_s3_bucket.this.arn
}

output "compute_function_arn" {
  description = "ARN of the Lambda function provisioned by the compute module."
  value       = module.compute.function_arn
}

output "compute_function_name" {
  description = "Name of the Lambda function provisioned by the compute module."
  value       = module.compute.function_name
}

output "storage_bucket_name" {
  description = "Name of the S3 bucket provisioned by the storage module."
  value       = module.storage.bucket_name
}

output "storage_bucket_arn" {
  description = "ARN of the S3 bucket provisioned by the storage module."
  value       = module.storage.bucket_arn
}