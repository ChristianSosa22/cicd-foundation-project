variable "environment" {
  description = "Deployment environment name (e.g., dev, staging, prod)."
  type        = string
}

variable "name" {
  description = "Name for the Lambda function."
  type        = string
}

variable "memory_size" {
  description = "Amount of memory in MB allocated to the Lambda function. Valid values: 128 to 10240."
  type        = number
  default     = 128
}