variable "environment" {
  description = "Deployment environment name (e.g., dev, staging, prod). Used to differentiate resources across environments."
  type        = string
  default     = "dev"
}

variable "project_name" {
  description = "Logical name of the project. Required — must be supplied via -var or a .tfvars file. Used for tagging and resource naming."
  type        = string
}

variable "region" {
  description = "AWS region in which all resources in this workspace will be created."
  type        = string
  default     = "us-east-1"
}

variable "bucket_name_prefix" {
  description = "Prefix used when constructing S3 bucket names. Combined with var.environment to form the final bucket name."
  type        = string
  default     = "myproject"
}
