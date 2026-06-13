# ── Project ───────────────────────────────────────────────────────────────────

variable "environment" {
  description = "Deployment environment name (e.g., dev, staging, prod). Used as a suffix in resource names and tags across all modules."
  type        = string
  default     = "dev"
}

variable "project_name" {
  description = "Logical name of the project. Required — supply via -var or a .tfvars file. Used as a prefix in all resource names."
  type        = string
}

variable "region" {
  description = "AWS region in which all resources are created."
  type        = string
  default     = "us-east-1"
}

# ── Network module ─────────────────────────────────────────────────────────────

variable "vpc_cidr" {
  description = "CIDR block for the custom VPC. Example: 10.0.0.0/16. Must not overlap with other VPCs in the account."
  type        = string
}

variable "az_count" {
  description = "Number of Availability Zones to span subnets across. Must be at least 2. Controls the expected length of public_subnet_cidrs, private_app_subnet_cidrs and private_data_subnet_cidrs."
  type        = number
  default     = 2
}

variable "public_subnet_cidrs" {
  description = "List of CIDR blocks for public subnets, one per AZ. Length must match az_count. Example: [\"10.0.0.0/24\", \"10.0.1.0/24\"]."
  type        = list(string)
}

variable "private_app_subnet_cidrs" {
  description = "List of CIDR blocks for the private application (ECS Fargate) subnets, one per AZ. Length must match az_count. Example: [\"10.0.11.0/24\", \"10.0.12.0/24\"]."
  type        = list(string)
}

variable "private_data_subnet_cidrs" {
  description = "List of CIDR blocks for the isolated private data (RDS) subnets, one per AZ. Length must match az_count. Example: [\"10.0.21.0/24\", \"10.0.22.0/24\"]."
  type        = list(string)
}

variable "single_nat_gateway" {
  description = "When true, a single NAT Gateway is shared by all private application subnets (cost-efficient for dev). When false, one NAT Gateway per AZ is provisioned (recommended for production HA). Data subnets are isolated and never use a NAT Gateway."
  type        = bool
  default     = true
}

# ── Database module ───────────────────────────────────────────────────────────

variable "db_name" {
  description = "Name of the PostgreSQL database. The parking API expects this to be 'parking'."
  type        = string
}

variable "db_username" {
  description = "Master username for the RDS instance."
  type        = string
}

variable "db_password" {
  description = "Master password for the RDS instance. Sensitive — supply via TF_VAR_db_password or a CI secret. Not used by the app (app reads DATABASE_URL from SSM); only needed for Terraform to provision the RDS instance."
  type        = string
  sensitive   = true
}

variable "db_port" {
  description = "Port number the PostgreSQL instance listens on."
  type        = number
  default     = 5432
}

variable "db_instance_class" {
  description = "RDS instance class. Use db.t3.micro for dev, db.t3.small or larger for production."
  type        = string
  default     = "db.t3.micro"
}

variable "db_allocated_storage" {
  description = "Allocated storage for the RDS instance in GB."
  type        = number
  default     = 20
}

variable "db_engine_version" {
  description = "PostgreSQL engine version for RDS (e.g., 16.14). The parameter group family is derived from the major version."
  type        = string
  default     = "16.14"
}

variable "multi_az" {
  description = "Enable Multi-AZ deployment for RDS. Enables automatic failover. Recommended true for production."
  type        = bool
  default     = false
}

variable "skip_final_snapshot" {
  description = "Skip the final snapshot when the RDS instance is destroyed. Set true for dev (allows clean teardown). Must be false in production."
  type        = bool
  default     = false
}

variable "deletion_protection" {
  description = "Enable deletion protection on the RDS instance. Prevents accidental destruction. Recommended true for production."
  type        = bool
  default     = false
}

# ── Compute module ────────────────────────────────────────────────────────────

variable "api_image_tag" {
  description = "Docker image tag for the API service. Combined with the ECR repository URL from the ecr module to form the full image URI. Example: 'latest' or 'v1.2.0'."
  type        = string
  default     = "latest"
}

variable "web_image_tag" {
  description = "Docker image tag for the web frontend service. Combined with the ECR repository URL from the ecr module to form the full image URI."
  type        = string
  default     = "latest"
}

variable "api_cpu" {
  description = "CPU units for the API Fargate task. Valid values: 256, 512, 1024, 2048, 4096."
  type        = number
  default     = 512
}

variable "api_memory" {
  description = "Memory in MB for the API Fargate task. Must be compatible with api_cpu."
  type        = number
  default     = 1024
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

# ── Security module ───────────────────────────────────────────────────────────

variable "app_port" {
  description = "Port that the API application container listens on."
  type        = number
  default     = 8080
}

variable "web_port" {
  description = "Port that the web frontend container listens on."
  type        = number
  default     = 3000
}


# ── ALB module ────────────────────────────────────────────────────────────────

variable "health_check_path" {
  description = "Path used by the ALB target group health check for the web service. Defaults to '/' per the delivery spec. The API target group uses a dedicated /health path internally."
  type        = string
  default     = "/"
}

# ── Async messaging module ────────────────────────────────────────────────────

variable "max_receive_count" {
  description = "Maximum number of times a message can be received before being moved to the DLQ. Shared across all three async flows (receipt, release, email). A value of 3 absorbs transient failures without excessive retries."
  type        = number
  default     = 3
}

variable "dlq_message_retention_seconds" {
  description = "Retention period for messages in all DLQs (seconds). Should be long enough to allow manual inspection and redrive. Example: 1209600 (14 days)."
  type        = number
  default     = 1209600
}

variable "receipt_visibility_timeout_seconds" {
  description = "Visibility timeout for the receipt queue (seconds). Must exceed the expected PDF generation + S3 upload time. Example: 60."
  type        = number
  default     = 60
}

variable "receipt_message_retention_seconds" {
  description = "Message retention for the receipt queue (seconds). Example: 345600 (4 days)."
  type        = number
  default     = 345600
}

variable "release_visibility_timeout_seconds" {
  description = "Visibility timeout for the release queue (seconds). The release-worker runs a batch UPDATE; 30s is sufficient. Example: 30."
  type        = number
  default     = 30
}

variable "release_message_retention_seconds" {
  description = "Message retention for the release queue (seconds). Example: 345600 (4 days)."
  type        = number
  default     = 345600
}

variable "email_visibility_timeout_seconds" {
  description = "Visibility timeout for the email queue (seconds). Must exceed the expected email API call time. Example: 30."
  type        = number
  default     = 30
}

variable "email_message_retention_seconds" {
  description = "Message retention for the email queue (seconds). Example: 345600 (4 days)."
  type        = number
  default     = 345600
}

# ── Scheduler module ──────────────────────────────────────────────────────────

variable "schedule_expression" {
  description = "EventBridge Scheduler expression for the expired-reservation sweep. Accepts cron or rate expressions. Example: 'rate(20 minutes)'."
  type        = string
  default     = "rate(20 minutes)"
}

variable "scheduler_timezone" {
  description = "IANA timezone for the scheduler. Determines when cron-based schedules fire relative to local time. Example: 'America/Guatemala'."
  type        = string
  default     = "America/Guatemala"
}

variable "scheduler_target_message" {
  description = "JSON message body sent to the release-queue on each scheduled invocation. Conforms to the ReleaseExpiredReservationCommand payload contract."
  type        = string
  default     = "{\"event_type\":\"ReleaseExpiredReservationCommand\",\"data\":{}}"
}
