output "state_bucket_name" {
  value       = aws_s3_bucket.tfstate.id
  description = "Name of the S3 bucket storing remote Terraform state."
}

output "state_bucket_arn" {
  value       = aws_s3_bucket.tfstate.arn
  description = "ARN of the S3 bucket storing remote Terraform state."
}

output "lock_table_name" {
  value       = aws_dynamodb_table.tfstate_lock.name
  description = "Name of the DynamoDB table used for Terraform state locking."
}

output "lock_table_arn" {
  value       = aws_dynamodb_table.tfstate_lock.arn
  description = "ARN of the DynamoDB table used for Terraform state locking."
}

output "region" {
  value       = var.region
  description = "AWS region where the remote state backend resources live."
}
