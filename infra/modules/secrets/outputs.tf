output "parameter_arns" {
  description = "Map of environment variable name to SSM parameter ARN. Wire these into the ECS execution role (ssm:GetParameters) and the task definition 'secrets' block."
  value = {
    DATABASE_URL   = aws_ssm_parameter.database_url.arn
    JWT_SECRET     = aws_ssm_parameter.jwt_secret.arn
    ENCRYPTION_KEY = aws_ssm_parameter.encryption_key.arn
    HMAC_KEY       = aws_ssm_parameter.hmac_key.arn
  }
}

output "parameter_names" {
  description = "Map of environment variable name to SSM parameter name (full path). Useful for documentation and out-of-band value population."
  value = {
    DATABASE_URL   = aws_ssm_parameter.database_url.name
    JWT_SECRET     = aws_ssm_parameter.jwt_secret.name
    ENCRYPTION_KEY = aws_ssm_parameter.encryption_key.name
    HMAC_KEY       = aws_ssm_parameter.hmac_key.name
  }
}

output "db_password_secret_arn" {
  description = "ARN of the Secrets Manager secret that stores the RDS master password."
  value       = aws_secretsmanager_secret.db_password.arn
}

output "db_password_secret_name" {
  description = "Name of the Secrets Manager secret that stores the RDS master password."
  value       = aws_secretsmanager_secret.db_password.name
}
