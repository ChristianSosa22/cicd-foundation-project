# ── Lambda Function ARNs ──────────────────────────────────────────────────────

output "receipt_worker_arn" {
  description = "ARN of the receipt-worker Lambda function."
  value       = aws_lambda_function.receipt_worker.arn
}

output "receipt_worker_name" {
  description = "Name of the receipt-worker Lambda function."
  value       = aws_lambda_function.receipt_worker.function_name
}

output "release_worker_arn" {
  description = "ARN of the release-worker Lambda function."
  value       = aws_lambda_function.release_worker.arn
}

output "release_worker_name" {
  description = "Name of the release-worker Lambda function."
  value       = aws_lambda_function.release_worker.function_name
}

output "email_worker_arn" {
  description = "ARN of the email-worker Lambda function."
  value       = aws_lambda_function.email_worker.arn
}

output "email_worker_name" {
  description = "Name of the email-worker Lambda function."
  value       = aws_lambda_function.email_worker.function_name
}

# ── Event Source Mapping IDs ──────────────────────────────────────────────────

output "receipt_event_source_mapping_id" {
  description = "UUID of the event source mapping connecting receipt SQS queue to receipt-worker Lambda."
  value       = aws_lambda_event_source_mapping.receipt.id
}

output "release_event_source_mapping_id" {
  description = "UUID of the event source mapping connecting release SQS queue to release-worker Lambda."
  value       = aws_lambda_event_source_mapping.release.id
}

output "email_event_source_mapping_id" {
  description = "UUID of the event source mapping connecting email SQS queue to email-worker Lambda."
  value       = aws_lambda_event_source_mapping.email.id
}
