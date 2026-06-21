variable "environment" {
  description = "Deployment environment name (e.g., dev, staging, prod). Used in resource names."
  type        = string
}

variable "project_name" {
  description = "Logical name of the project. Used for tagging and resource naming."
  type        = string
}

variable "db_name" {
  description = "Name of the PostgreSQL database to create. The parking API expects this to be 'parking'."
  type        = string
}

variable "db_username" {
  description = "Master username for the RDS instance."
  type        = string
}

variable "db_password" {
  description = "Master password for the RDS instance. Sensitive — do not commit. Supply via -var or a CI secret. The app-facing DATABASE_URL is set separately in SSM (see secrets module)."
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
  description = "PostgreSQL engine version. Must be a version supported by RDS (e.g., 16.14). The parameter group family is derived from the major version."
  type        = string
  default     = "16.14"
}

variable "multi_az" {
  description = "Enable Multi-AZ deployment for RDS. Set to true for production to enable automatic failover."
  type        = bool
  default     = false
}

variable "db_max_connections" {
  description = "Value for the max_connections PostgreSQL parameter. Each API container maintains a connection pool; size accordingly."
  type        = string
  default     = "100"
}

variable "skip_final_snapshot" {
  description = "Skip the final snapshot when the RDS instance is destroyed. Set to true for dev to allow clean teardown. Must be false in production."
  type        = bool
  default     = false
}

variable "deletion_protection" {
  description = "Enable deletion protection on the RDS instance. Prevents accidental destruction. Recommended true for production, false for dev."
  type        = bool
  default     = false
}

variable "kms_key_arn" {
  description = "ARN of the KMS CMK used to encrypt the RDS storage. Requires storage_encrypted = true."
  type        = string
}

variable "subnet_ids" {
  description = "Private subnet IDs used for the RDS DB subnet group. The DB will only be reachable from within these subnets."
  type        = list(string)
}

variable "db_security_group_id" {
  description = "ID of the database security group (db-sg) from the security module. Attached to the RDS instance."
  type        = string
}
