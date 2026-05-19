output "db_instance_arn" {
  description = "ARN of the RDS database instance."
  value       = aws_db_instance.default.arn
}

output "db_endpoint" {
  description = "Endpoint of the RDS database instance."
  value       = aws_db_instance.default.endpoint
}

output "db_security_group_id" {
  description = "ID of the security group associated with the RDS database."
  value       = aws_security_group.db_sg.id
}