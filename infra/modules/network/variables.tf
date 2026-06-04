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
  description = "Number of Availability Zones to span subnets across. Must be at least 2 for production HA. Also controls the length of public_subnet_cidrs and private_subnet_cidrs."
  type        = number
  default     = 2
}

variable "public_subnet_cidrs" {
  description = "List of CIDR blocks for public subnets, one per AZ. Length must equal az_count. These subnets host the Internet Gateway route and, in a future task, the ALB. Example: [\"10.0.0.0/24\", \"10.0.1.0/24\"]."
  type        = list(string)
}

variable "private_subnet_cidrs" {
  description = "List of CIDR blocks for private subnets, one per AZ. Length must equal az_count. ECS tasks and RDS instances are placed here. Egress routes through the NAT Gateway. Example: [\"10.0.10.0/24\", \"10.0.11.0/24\"]."
  type        = list(string)
}

variable "single_nat_gateway" {
  description = "When true, provision a single NAT Gateway shared by all private subnets (cost-efficient for dev/staging). When false, provision one NAT Gateway per AZ for high availability (recommended for production)."
  type        = bool
  default     = true
}
