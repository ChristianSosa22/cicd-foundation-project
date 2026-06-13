output "schedule_arn" {
  description = "ARN of the EventBridge Scheduler schedule. Use this in IAM policies or CloudWatch alarms."
  value       = aws_scheduler_schedule.this.arn
}

output "schedule_name" {
  description = "Name of the EventBridge Scheduler schedule as it appears in the AWS console."
  value       = aws_scheduler_schedule.this.name
}

output "scheduler_role_arn" {
  description = "ARN of the IAM role assumed by EventBridge Scheduler. Scoped to sqs:SendMessage on the target queue only."
  value       = aws_iam_role.scheduler.arn
}
