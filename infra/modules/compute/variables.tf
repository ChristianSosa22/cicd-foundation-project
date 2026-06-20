variable "environment" {
  description = "Deployment environment name (e.g., dev, staging, prod)."
  type        = string
}

variable "name" {
  description = "Project name prefix. Used to name the ECS cluster, services, roles, and security groups."
  type        = string
}

variable "region" {
  description = "AWS region where resources are created. Used for CloudWatch log stream configuration."
  type        = string
  default     = "us-east-1"
}

variable "subnet_ids" {
  description = "List of subnet IDs where Fargate tasks are placed. Use public subnets with assign_public_ip=true to avoid NAT Gateway costs."
  type        = list(string)
}

variable "assign_public_ip" {
  description = "Assign a public IP to each Fargate task. Required when tasks run in public subnets so they can reach AWS APIs (ECR, Secrets Manager, SQS) via the Internet Gateway instead of a NAT Gateway."
  type        = bool
  default     = true
}

# ── API service (Node/Express backend, port 8080) ──────────────────────────────

variable "api_image" {
  description = "Full ECR image URI for the API service, including tag. Example: 123456789012.dkr.ecr.us-east-1.amazonaws.com/oyd-project-api:latest."
  type        = string
}

variable "api_cpu" {
  description = "CPU units for the API Fargate task. Valid values: 256, 512, 1024, 2048, 4096."
  type        = number
  default     = 512
}

variable "api_memory" {
  description = "Memory in MB for the API Fargate task. Must be compatible with api_cpu (see AWS Fargate task size table)."
  type        = number
  default     = 1024
}

variable "api_desired_count" {
  description = "Desired number of running API task instances. Set to 0 to stop the service without destroying it."
  type        = number
  default     = 1
}

# ── Web service (Next.js standalone frontend, port 3000) ──────────────────────

variable "web_image" {
  description = "Full ECR image URI for the web frontend service, including tag. Example: 123456789012.dkr.ecr.us-east-1.amazonaws.com/oyd-project-web:latest."
  type        = string
}

variable "web_cpu" {
  description = "CPU units for the web Fargate task. Valid values: 256, 512, 1024, 2048, 4096."
  type        = number
  default     = 256
}

variable "web_memory" {
  description = "Memory in MB for the web Fargate task. Must be compatible with web_cpu."
  type        = number
  default     = 512
}

variable "web_desired_count" {
  description = "Desired number of running web task instances. Set to 0 to stop the service without destroying it."
  type        = number
  default     = 1
}

# ── Non-secret environment variables ──────────────────────────────────────────

variable "aws_region" {
  description = "AWS region injected into the API container as AWS_REGION. Used by the AWS SDK for S3 presigned URL generation."
  type        = string
  default     = "us-east-1"
}

variable "s3_bucket" {
  description = "Name of the S3 receipts bucket, injected into the API container as S3_BUCKET. The API uses this to store and retrieve receipt PDFs/QR codes."
  type        = string
}

# ── Secret ARNs from SSM Parameter Store ──────────────────────────────────────

variable "secret_arns" {
  description = "Map of environment variable name to SSM parameter ARN. Injected into the API task definition as 'secrets' so Fargate pulls them at container start. Required keys: DATABASE_URL, JWT_SECRET, ENCRYPTION_KEY, HMAC_KEY."
  type        = map(string)
}

# ── Security group IDs (created by security module) ───────────────────────────

variable "api_security_group_id" {
  description = "ID of the app-sg security group from the security module. Attached to the API ECS service."
  type        = string
}

variable "web_service_security_group_id" {
  description = "ID of the web-service-sg security group from the security module. Attached to the web ECS service."
  type        = string
}

# ── IAM: S3 receipts access ───────────────────────────────────────────────────

variable "receipts_bucket_arn" {
  description = "ARN of the S3 receipts bucket. Grants the API task role s3:GetObject and s3:PutObject on this bucket for receipt storage and presigned URL generation."
  type        = string
}

# ── ALB integration (provided by the alb module via the root module) ──────────

variable "api_target_group_arn" {
  description = "ARN of the ALB target group for the API service. The API ECS service registers its task IPs here via its load_balancer block."
  type        = string
}

variable "web_target_group_arn" {
  description = "ARN of the ALB target group for the web service. The web ECS service registers its task IPs here via its load_balancer block."
  type        = string
}
# ── Worker service (async SQS consumer — Delivery 4) ──────────────────────────

variable "worker_cpu" {
  description = "CPU units for the async worker Fargate task. Valid values: 256, 512, 1024, 2048, 4096."
  type        = number
  default     = 256
}

variable "worker_memory" {
  description = "Memory in MB for the async worker Fargate task. Must be compatible with worker_cpu (see AWS Fargate task size table)."
  type        = number
  default     = 512
}

variable "worker_desired_count" {
  description = "Desired number of running async worker task instances. Set to 0 to stop polling without destroying the service; 1 keeps a single consumer polling the receipt queue."
  type        = number
  default     = 1
}

variable "worker_security_group_id" {
  description = "ID of the security group attached to the async worker ECS service. The worker only needs egress (to SQS, S3, and the DB); it exposes no inbound ports."
  type        = string
}

variable "sqs_queue_url" {
  description = "URL of the receipt SQS queue (from the async module output queue_url). Injected into the worker container as RECEIPT_QUEUE_URL so the consumer knows which queue to poll. No hardcoded value."
  type        = string
}

variable "sqs_queue_arn" {
  description = "ARN of the receipt SQS queue (from the async module output queue_arn). Used to scope the worker task role's sqs:ReceiveMessage/DeleteMessage/GetQueueAttributes permissions to this specific queue — no wildcard."
  type        = string
}

variable "compute_exec_role_arn" {
  description = "ARN of the ECS task execution role from the IAM module. Used by all ECS task definitions to pull images, write logs, and read SSM/Secrets Manager parameters."
  type        = string
}

variable "compute_task_role_arn" {
  description = "ARN of the API task role from the IAM module. Grants the running API container access to S3, SQS, RDS, and KMS."
  type        = string
}

variable "polling_batch_size" {
  description = "Maximum number of messages the worker requests per SQS ReceiveMessage call (1-10). Injected as POLLING_BATCH_SIZE. Higher values improve throughput; lower values reduce per-message latency."
  type        = number
  default     = 10
}
