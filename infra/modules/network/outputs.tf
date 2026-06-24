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

# ── VPC Endpoints ──────────────────────────────────────────────────────────────

output "s3_vpc_endpoint_id" {
  description = "ID of the S3 Gateway VPC Endpoint."
  value       = try(aws_vpc_endpoint.s3[0].id, null)
}

output "s3_vpc_endpoint_prefix_list_id" {
  description = "Prefix list ID for S3 Gateway VPC Endpoint. Use in route table entries."
  value       = try(aws_vpc_endpoint.s3[0].prefix_list_id, null)
}

output "interface_vpc_endpoint_ids" {
  description = "Map of service key to Interface VPC Endpoint ID."
  value       = { for k, v in aws_vpc_endpoint.interface : k => v.id }
}

output "interface_vpc_endpoint_dns" {
  description = "Map of service key to first DNS name of the Interface VPC Endpoint."
  value       = { for k, v in aws_vpc_endpoint.interface : k => v.dns_entry[0]["dns_name"] }
}

output "vpce_security_group_id" {
  description = "ID of the VPC Endpoints security group (created inside network module)."
  value       = try(aws_security_group.vpce[0].id, null)
}
