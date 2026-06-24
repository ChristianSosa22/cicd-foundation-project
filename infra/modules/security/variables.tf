variable "name" {
  description = "Project name prefix used to name all security group resources."
  type        = string
}

variable "environment" {
  description = "Deployment environment name (dev, staging, prod). Included in SG names."
  type        = string
}

variable "vpc_id" {
  description = "ID of the VPC in which security groups are created."
  type        = string
}

variable "http_port" {
  description = "HTTP port for the web/ALB public ingress."
  type        = number
  default     = 80
}

variable "https_port" {
  description = "HTTPS port for the web/ALB public ingress."
  type        = number
  default     = 443
}

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

variable "db_port" {
  description = "Port the database listens on (RDS PostgreSQL)."
  type        = number
  default     = 5432
}

variable "allowed_ingress_cidrs" {
  description = "List of CIDR blocks allowed to access the web/ALB tier HTTP/HTTPS ports."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "vpce_security_group_id" {
  description = "ID of the VPC Endpoints security group. Used by the lambda SG to allow egress to VPC Endpoints."
  type        = string
}
