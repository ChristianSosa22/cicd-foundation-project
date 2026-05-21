variable "environment" {
  description = "Deployment environment name (e.g., dev, staging, prod)."
  type        = string
}

variable "name" {
  description = "Name for the ECS service and related resources."
  type        = string
}

variable "cpu" {
  description = "Number of CPU units for the Fargate task. Valid values: 256, 512, 1024, 2048, 4096."
  type        = number
  default     = 256
}

variable "memory" {
  description = "Amount of memory in MB for the Fargate task. Must be compatible with the cpu value."
  type        = number
  default     = 512
}