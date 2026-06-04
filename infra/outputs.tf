# ── Network ───────────────────────────────────────────────────────────────────

output "vpc_id" {
  description = "ID of the custom VPC."
  value       = module.network.vpc_id
}

output "public_subnet_ids" {
  description = "IDs of the public subnets (one per AZ). Pass to the ALB module in the follow-up task."
  value       = module.network.public_subnet_ids
}

output "private_subnet_ids" {
  description = "IDs of the private subnets (one per AZ). Used by ECS tasks and RDS."
  value       = module.network.private_subnet_ids
}

output "nat_gateway_ids" {
  description = "IDs of the NAT Gateways provisioned for private-subnet egress."
  value       = module.network.nat_gateway_ids
}

# ── Registry ──────────────────────────────────────────────────────────────────

output "ecr_api_repository_url" {
  description = "ECR repository URL for the API image. Use this to push: docker push <url>:<tag>."
  value       = module.ecr.api_repository_url
}

output "ecr_web_repository_url" {
  description = "ECR repository URL for the web image. Use this to push: docker push <url>:<tag>."
  value       = module.ecr.web_repository_url
}

# ── Secrets (paths only — not values) ─────────────────────────────────────────

output "ssm_parameter_names" {
  description = "SSM parameter paths that must be populated out-of-band. See infra/README.md for the aws ssm put-parameter commands."
  value       = module.secrets.parameter_names
}

# ── Compute ───────────────────────────────────────────────────────────────────

output "ecs_cluster_name" {
  description = "Name of the ECS cluster."
  value       = module.compute.cluster_name
}

output "ecs_cluster_arn" {
  description = "ARN of the ECS cluster."
  value       = module.compute.cluster_arn
}

output "ecs_api_service_name" {
  description = "Name of the API ECS service. Reference this when adding ALB target group."
  value       = module.compute.api_service_name
}

output "ecs_web_service_name" {
  description = "Name of the web ECS service. Reference this when adding ALB target group."
  value       = module.compute.web_service_name
}

output "ecs_api_security_group_id" {
  description = "Security group ID for the API service. Used as the ingress source on the RDS SG and the ALB target SG."
  value       = module.compute.api_security_group_id
}

output "ecs_web_security_group_id" {
  description = "Security group ID for the web service. Used as the ALB target SG."
  value       = module.compute.web_security_group_id
}

# ── Database ──────────────────────────────────────────────────────────────────

output "db_endpoint" {
  description = "RDS endpoint (host:port). Use this to assemble the DATABASE_URL SSM parameter: postgres://<user>:<pass>@<address>:<port>/<db_name>."
  value       = module.database.db_endpoint
}

output "db_address" {
  description = "RDS hostname (without port). For DATABASE_URL construction."
  value       = module.database.db_address
}

output "db_instance_arn" {
  description = "ARN of the RDS database instance."
  value       = module.database.db_instance_arn
}

# ── Storage ───────────────────────────────────────────────────────────────────

output "receipts_bucket_name" {
  description = "Name of the S3 receipts bucket. Set this as the S3_BUCKET environment variable in the API container."
  value       = module.storage.bucket_name
}

output "receipts_bucket_arn" {
  description = "ARN of the S3 receipts bucket."
  value       = module.storage.bucket_arn
}
