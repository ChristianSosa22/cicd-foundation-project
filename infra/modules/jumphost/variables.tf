variable "name" {
  description = "Project name prefix used in resource names and tags."
  type        = string
}

variable "environment" {
  description = "Deployment environment name (dev, prod). Used in resource names and tags."
  type        = string
}

variable "subnet_id" {
  description = "Private app subnet to place the jump host in. Must have a NAT Gateway route for SSM traffic and network adjacency to the RDS security group."
  type        = string
}

variable "security_group_id" {
  description = "Security group to attach to the jump host. Should be the app-tier SG so the DB security group already allows inbound PostgreSQL from it."
  type        = string
}
