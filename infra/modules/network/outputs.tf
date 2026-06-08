output "vpc_id" {
  description = "ID of the provisioned custom VPC."
  value       = aws_vpc.this.id
}

output "vpc_cidr" {
  description = "CIDR block of the VPC. Useful for scoping security group ingress rules to VPC-internal traffic."
  value       = aws_vpc.this.cidr_block
}

output "public_subnet_ids" {
  description = "List of IDs for the public subnets, one per AZ. Pass these to the ALB module."
  value       = aws_subnet.public[*].id
}

output "private_app_subnet_ids" {
  description = "List of IDs for the private application subnets, one per AZ. Pass these to the compute module (ECS Fargate tasks)."
  value       = aws_subnet.private_app[*].id
}

output "private_data_subnet_ids" {
  description = "List of IDs for the isolated private data subnets, one per AZ. Pass these to the database module (RDS)."
  value       = aws_subnet.private_data[*].id
}

output "nat_gateway_ids" {
  description = "List of NAT Gateway IDs. Length is 1 when single_nat_gateway=true, or az_count when single_nat_gateway=false."
  value       = aws_nat_gateway.this[*].id
}

output "public_nacl_id" {
  description = "ID of the public subnet Network ACL."
  value       = aws_network_acl.public.id
}

output "private_nacl_id" {
  description = "ID of the private subnet Network ACL."
  value       = aws_network_acl.private.id
}
