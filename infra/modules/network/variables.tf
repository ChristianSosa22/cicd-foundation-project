variable "name" {
  description = "Project name prefix used to name all network resources (e.g. oyd-project)."
  type        = string
}

variable "environment" {
  description = "Deployment environment name (e.g., dev, staging, prod). Included in resource names."
  type        = string
}

variable "vpc_cidr" {
  description = "CIDR block for the custom VPC. Must not overlap with other VPCs in your account. Example: 10.0.0.0/16."
  type        = string
}

variable "az_count" {
  description = "Number of Availability Zones to span subnets across. Must be at least 2 for production HA. Also controls the length of public_subnet_cidrs, private_app_subnet_cidrs and private_data_subnet_cidrs."
  type        = number
  default     = 2
}

variable "public_subnet_cidrs" {
  description = "List of CIDR blocks for public subnets, one per AZ. Length must equal az_count. These subnets host the Internet Gateway route and, in a future task, the ALB. Example: [\"10.0.0.0/24\", \"10.0.1.0/24\"]."
  type        = list(string)
}

variable "private_app_subnet_cidrs" {
  description = "List of CIDR blocks for the private application subnets, one per AZ. Length must equal az_count. ECS Fargate tasks are placed here. Egress routes through the NAT Gateway. Example: [\"10.0.11.0/24\", \"10.0.12.0/24\"]."
  type        = list(string)
}

variable "private_data_subnet_cidrs" {
  description = "List of CIDR blocks for the private data subnets, one per AZ. Length must equal az_count. RDS instances are isolated here with no route to the internet. Example: [\"10.0.21.0/24\", \"10.0.22.0/24\"]."
  type        = list(string)
}

variable "single_nat_gateway" {
  description = "When true, provision a single NAT Gateway shared by all private application subnets (cost-efficient for dev/staging). When false, provision one NAT Gateway per AZ for high availability (recommended for production). Data subnets are isolated and never use a NAT Gateway."
  type        = bool
  default     = true
}

# ── NACL / port variables ───────────────────────────────────────────────────┐

variable "http_port" {
  description = "HTTP port for NACL rules. Used to allow ALB inbound and outbound HTTP traffic."
  type        = number
  default     = 80
}

variable "https_port" {
  description = "HTTPS port for NACL rules. Used to allow ALB inbound and outbound HTTPS traffic."
  type        = number
  default     = 443
}

variable "app_port" {
  description = "API application port for NACL rules. Used to allow traffic between ALB and API tasks."
  type        = number
  default     = 8080
}

variable "web_port" {
  description = "Web frontend port for NACL rules. Used to allow traffic between ALB and web tasks."
  type        = number
  default     = 3000
}

variable "db_port" {
  description = "Database port for NACL rules. Used to allow API-to-RDS traffic."
  type        = number
  default     = 5432
}

variable "ephemeral_from" {
  description = "Start of ephemeral port range for NACL rules. Required for return traffic in stateless ACLs."
  type        = number
  default     = 1024
}

variable "ephemeral_to" {
  description = "End of ephemeral port range for NACL rules."
  type        = number
  default     = 65535
}
