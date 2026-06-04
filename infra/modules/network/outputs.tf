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

output "private_subnet_ids" {
  description = "List of IDs for the private subnets, one per AZ. Pass these to the compute and database modules."
  value       = aws_subnet.private[*].id
}

output "nat_gateway_ids" {
  description = "List of NAT Gateway IDs. Length is 1 when single_nat_gateway=true, or az_count when single_nat_gateway=false."
  value       = aws_nat_gateway.this[*].id
}
