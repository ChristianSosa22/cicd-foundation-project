output "db_instance_arn" {
  description = "ARN of the RDS database instance."
  value       = aws_db_instance.default.arn
}

output "db_endpoint" {
  description = "Full connection endpoint of the RDS instance (host:port). Use this to assemble the DATABASE_URL SSM parameter."
  value       = aws_db_instance.default.endpoint
}

output "db_address" {
  description = "Hostname of the RDS instance (without port). Use in DATABASE_URL: postgres://user:pass@<address>:<port>/dbname."
  value       = aws_db_instance.default.address
}

output "db_port" {
  description = "Port the RDS instance listens on. Included for DATABASE_URL assembly."
  value       = aws_db_instance.default.port
}

output "db_name" {
  description = "Name of the database created on the RDS instance. Included for DATABASE_URL assembly."
  value       = aws_db_instance.default.db_name
}

output "db_security_group_id" {
  description = "ID of the security group associated with the RDS instance (from the security module)."
  value       = var.db_security_group_id
}
