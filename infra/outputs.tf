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

output "db_instance_arn" {
  description = "ARN of the RDS database instance."
  value       = module.database.db_instance_arn
}

output "db_endpoint" {
  description = "Endpoint of the RDS database instance."
  value       = module.database.db_endpoint
}

output "db_security_group_id" {
  description = "ID of the security group associated with the RDS database."
  value       = module.database.db_security_group_id
}