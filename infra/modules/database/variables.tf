variable "environment" {
  description = "Deployment environment name (e.g., dev, staging, prod). Used to differentiate resources across environments."
  type        = string
}

variable "project_name" {
  description = "Logical name of the project. Used for tagging and resource naming."
  type        = string
}

variable "db_name" {
  description = "Name of the database."
  type        = string
}

variable "db_username" {
  description = "Username for the database."
  type        = string
}

variable "db_password" {
  description = "Password for the database. Marked as sensitive."
  type        = string
  sensitive   = true
}

variable "db_port" {
  description = "Port number for the database."
  type        = number
  default     = 5432
}

variable "db_instance_class" {
  description = "Instance class for the RDS database."
  type        = string
  default     = "db.t3.micro"
}

variable "db_allocated_storage" {
  description = "Allocated storage for the RDS database in GB."
  type        = number
  default     = 20
}

variable "db_engine_version" {
  description = "Engine version for the RDS database."
  type        = string
  default     = "16.0"
}

variable "multi_az" {
  description = "Whether the RDS instance should be multi-AZ."
  type        = bool
  default     = false
}

variable "db_max_connections" {
  description = "Maximum number of database connections."
  type        = string
  default     = "100"
}

variable "vpc_id" {
  description = "ID of the VPC in which the DB security group and subnet group are created."
  type        = string
}

variable "subnet_ids" {
  description = "Subnet IDs used for the RDS DB subnet group."
  type        = list(string)
}

variable "ingress_security_group_ids" {
  description = "Security group IDs allowed to connect to the database on db_port (e.g. the ECS tasks SG)."
  type        = list(string)
  default     = []
}