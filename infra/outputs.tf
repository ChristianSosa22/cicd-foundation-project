# ── Network ───────────────────────────────────────────────────────────────────

output "vpc_id" {
  description = "ID of the custom VPC."
  value       = module.network.vpc_id
}

output "public_subnet_ids" {
  description = "IDs of the public subnets (one per AZ). Consumed by the ALB module for the internet-facing load balancer."
  value       = module.network.public_subnet_ids
}

output "private_app_subnet_ids" {
  description = "IDs of the private application subnets (one per AZ). Used by ECS Fargate tasks."
  value       = module.network.private_app_subnet_ids
}

output "private_data_subnet_ids" {
  description = "IDs of the isolated private data subnets (one per AZ). Used by RDS."
  value       = module.network.private_data_subnet_ids
}

output "nat_gateway_ids" {
  description = "IDs of the NAT Gateways provisioned for private-subnet egress."
  value       = module.network.nat_gateway_ids
}

output "public_nacl_id" {
  description = "ID of the public subnet Network ACL. Use this to verify NACL rules."
  value       = module.network.public_nacl_id
}

output "private_nacl_id" {
  description = "ID of the private subnet Network ACL. Use this to verify NACL rules."
  value       = module.network.private_nacl_id
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
  description = "Name of the API ECS service. Registered behind the ALB API target group."
  value       = module.compute.api_service_name
}

output "ecs_web_service_name" {
  description = "Name of the web ECS service. Registered behind the ALB web target group."
  value       = module.compute.web_service_name
}

output "web_security_group_id" {
  description = "Security group ID for the web/ALB tier (public-facing). Attach to the ALB when provisioning ingress."
  value       = module.security.web_security_group_id
}

output "app_security_group_id" {
  description = "Security group ID for the application tier (API service)."
  value       = module.security.app_security_group_id
}

output "web_service_security_group_id" {
  description = "Security group ID for the web service tier (Next.js)."
  value       = module.security.web_service_security_group_id
}

output "db_security_group_id" {
  description = "Security group ID for the database tier (RDS)."
  value       = module.security.db_security_group_id
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

# ── Async Messaging ───────────────────────────────────────────────────────────

output "receipt_queue_url" {
  description = "URL of the receipt SQS queue. The API producer enqueues GenerateReceiptCommand here."
  value       = module.async_receipt.queue_url
}

output "receipt_queue_arn" {
  description = "ARN of the receipt SQS queue. Use in IAM policies for the receipt-worker Lambda."
  value       = module.async_receipt.queue_arn
}

output "receipt_dlq_url" {
  description = "URL of the receipt DLQ. Inspect failed receipt generation messages here."
  value       = module.async_receipt.dlq_url
}

output "receipt_dlq_arn" {
  description = "ARN of the receipt DLQ. Use in CloudWatch alarms to alert on dead-lettered messages."
  value       = module.async_receipt.dlq_arn
}

output "release_queue_url" {
  description = "URL of the release SQS queue. The EventBridge Scheduler sends ReleaseExpiredReservationCommand here."
  value       = module.async_release.queue_url
}

output "release_queue_arn" {
  description = "ARN of the release SQS queue. Use in IAM policies for the release-worker Lambda."
  value       = module.async_release.queue_arn
}

output "release_dlq_url" {
  description = "URL of the release DLQ. Inspect failed release sweep messages here."
  value       = module.async_release.dlq_url
}

output "release_dlq_arn" {
  description = "ARN of the release DLQ. Use in CloudWatch alarms to alert on dead-lettered messages."
  value       = module.async_release.dlq_arn
}

output "email_queue_url" {
  description = "URL of the email SQS queue. SNS fan-out delivers ReceiptReadyEvent here for the email-worker."
  value       = module.async_email.queue_url
}

output "email_queue_arn" {
  description = "ARN of the email SQS queue. Use in IAM policies for the email-worker Lambda and SNS subscription."
  value       = module.async_email.queue_arn
}

output "email_dlq_url" {
  description = "URL of the email DLQ. Inspect failed email delivery messages here."
  value       = module.async_email.dlq_url
}

output "email_dlq_arn" {
  description = "ARN of the email DLQ. Use in CloudWatch alarms to alert on dead-lettered messages."
  value       = module.async_email.dlq_arn
}

# ── Scheduler ─────────────────────────────────────────────────────────────────

output "scheduler_schedule_name" {
  description = "Name of the EventBridge Scheduler schedule that triggers expired-reservation sweeps."
  value       = module.scheduler.schedule_name
}

output "scheduler_role_arn" {
  description = "ARN of the IAM role assumed by EventBridge Scheduler. Scoped to sqs:SendMessage on the release-queue only."
  value       = module.scheduler.scheduler_role_arn
}

# ── Load Balancer (public ingress) ────────────────────────────────────────────

output "alb_dns_name" {
  description = "Public DNS name of the ALB. Resolve and curl this to reach the application."
  value       = module.alb.alb_dns_name
}

output "ssm_jump_instance_id" {
  description = "Instance ID of the SSM jump host. Use this to open an RDS port-forwarding tunnel — see infra/README.md for the full command."
  value       = module.jumphost.instance_id
}

output "alb_url" {
  description = "Public HTTP URL of the application (http://<alb_dns_name>). Web frontend at /, backend at /api, /availability, /reservar. Use this in curl evidence."
  value       = module.alb.alb_url
}

# ── IAM Module ────────────────────────────────────────────────────────────────

output "iam_compute_exec_role_arn" {
  description = "ARN of the ECS task execution role (IAM module)."
  value       = module.iam.compute_exec_role_arn
}

output "iam_compute_task_role_arn" {
  description = "ARN of the API task role (IAM module). Grants S3, SQS, RDS, KMS access."
  value       = module.iam.compute_task_role_arn
}

output "iam_async_receipt_role_arn" {
  description = "ARN of the receipt worker Lambda execution role (IAM module)."
  value       = module.iam.async_receipt_role_arn
}

output "iam_async_release_role_arn" {
  description = "ARN of the release worker Lambda execution role (IAM module)."
  value       = module.iam.async_release_role_arn
}

output "iam_async_email_role_arn" {
  description = "ARN of the email worker Lambda execution role (IAM module)."
  value       = module.iam.async_email_role_arn
}

output "iam_scheduler_role_arn" {
  description = "ARN of the EventBridge Scheduler role (IAM module). Scoped to sqs:SendMessage on release queue."
  value       = module.iam.scheduler_role_arn
}

output "iam_ci_runner_role_arn" {
  description = "ARN of the GitHub Actions CI runner role (IAM module). Assumable via OIDC."
  value       = module.iam.ci_runner_role_arn
}

# ── TLS / HTTPS ───────────────────────────────────────────────────────────────

output "acm_certificate_arn" {
  description = "ARN of the ACM certificate (Deliverable D)."
  value       = module.alb.acm_certificate_arn
}

output "alb_https_url" {
  description = "Public HTTPS URL of the application (https://<app_fqdn>). Use this in curl evidence for TLS verification."
  value       = module.alb.alb_https_url
}

output "app_fqdn" {
  description = "Fully-qualified domain name of the application (Route 53 alias record)."
  value       = module.alb.app_fqdn
}

# ── Observability ─────────────────────────────────────────────────────────────

output "observability_sns_topic_arn" {
  description = "ARN of the SNS alerts topic. Subscribe additional endpoints (Slack, PagerDuty) here for multi-channel notifications."
  value       = module.observability.sns_topic_arn
}

output "observability_dashboard_name" {
  description = "Name of the CloudWatch dashboard. Open it at https://console.aws.amazon.com/cloudwatch/home#dashboards:name=<value>."
  value       = module.observability.dashboard_name
}

output "observability_budget_name" {
  description = "Name of the AWS Budget. Verify it at https://console.aws.amazon.com/billing/home#/budgets."
  value       = module.observability.budget_name
}