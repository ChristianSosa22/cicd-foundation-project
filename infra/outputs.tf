output "compute_cluster_arn" {
  description = "ARN of the ECS cluster provisioned by the compute module."
  value       = module.compute.cluster_arn
}

output "compute_cluster_name" {
  description = "Name of the ECS cluster provisioned by the compute module."
  value       = module.compute.cluster_name
}

output "compute_task_definition_arn" {
  description = "ARN of the ECS task definition provisioned by the compute module."
  value       = module.compute.task_definition_arn
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