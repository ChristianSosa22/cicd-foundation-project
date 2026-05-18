output "function_arn" {
  description = "ARN of the Lambda function. Use this to grant invocation permissions from other resources."
  value       = aws_lambda_function.this.arn
}

output "function_name" {
  description = "Name of the Lambda function."
  value       = aws_lambda_function.this.function_name
}