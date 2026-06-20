# ── Compute Execution Role ─────────────────────────────────────────────────────
output "compute_exec_role_arn" {
  description = "ARN of the ECS task execution role for the API. Assumed by the Fargate agent to pull images, write logs, and read SSM secrets."
  value       = aws_iam_role.compute_exec.arn
}

output "compute_exec_role_name" {
  description = "Name of the ECS task execution role."
  value       = aws_iam_role.compute_exec.name
}

# ── Compute Task Role (API) ────────────────────────────────────────────────────
output "compute_task_role_arn" {
  description = "ARN of the API task role. Assumed by the running API container for S3, SQS, RDS, and KMS access."
  value       = aws_iam_role.compute_task.arn
}

output "compute_task_role_name" {
  description = "Name of the API task role."
  value       = aws_iam_role.compute_task.name
}

# ── Async Consumer: Receipt Worker ─────────────────────────────────────────────
output "async_receipt_role_arn" {
  description = "ARN of the receipt worker Lambda execution role. Grants SQS consume, S3 PutObject, SNS Publish, Secrets Manager, and KMS access."
  value       = aws_iam_role.async_consumer_receipt.arn
}

output "async_receipt_role_name" {
  description = "Name of the receipt worker Lambda execution role."
  value       = aws_iam_role.async_consumer_receipt.name
}

# ── Async Consumer: Release Worker ─────────────────────────────────────────────
output "async_release_role_arn" {
  description = "ARN of the release worker Lambda execution role. Grants SQS consume on the release queue, Secrets Manager, and KMS access."
  value       = aws_iam_role.async_consumer_release.arn
}

output "async_release_role_name" {
  description = "Name of the release worker Lambda execution role."
  value       = aws_iam_role.async_consumer_release.name
}

# ── Async Consumer: Email Worker ───────────────────────────────────────────────
output "async_email_role_arn" {
  description = "ARN of the email worker Lambda execution role. Grants SQS consume on the email queue, Secrets Manager, and KMS access."
  value       = aws_iam_role.async_consumer_email.arn
}

output "async_email_role_name" {
  description = "Name of the email worker Lambda execution role."
  value       = aws_iam_role.async_consumer_email.name
}

# ── Scheduler Role ────────────────────────────────────────────────────────────
output "scheduler_role_arn" {
  description = "ARN of the EventBridge Scheduler role. Grants sqs:SendMessage on the release queue only."
  value       = aws_iam_role.scheduler.arn
}

output "scheduler_role_name" {
  description = "Name of the EventBridge Scheduler role."
  value       = aws_iam_role.scheduler.name
}

# ── CI Runner Role (OIDC) ──────────────────────────────────────────────────────
output "ci_runner_role_arn" {
  description = "ARN of the GitHub Actions CI runner role. Assumable via OIDC. Grants terraform plan/apply permissions."
  value       = aws_iam_role.ci_runner.arn
}

output "ci_runner_role_name" {
  description = "Name of the GitHub Actions CI runner role."
  value       = aws_iam_role.ci_runner.name
}
