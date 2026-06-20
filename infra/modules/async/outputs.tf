output "queue_url" {
  description = "URL of the main SQS queue. Use this as the queue endpoint for producers and consumers."
  value       = aws_sqs_queue.main.url
}

output "queue_arn" {
  description = "ARN of the main SQS queue. Use this in IAM policies and event source mappings."
  value       = aws_sqs_queue.main.arn
}

output "dlq_url" {
  description = "URL of the dead-letter queue. Use this to inspect failed messages or trigger redrive operations."
  value       = aws_sqs_queue.dlq.url
}

output "dlq_arn" {
  description = "ARN of the dead-letter queue. Use this in IAM policies or CloudWatch alarms for DLQ monitoring."
  value       = aws_sqs_queue.dlq.arn
}

output "dlq_name" {
  description = "Name of the dead-letter queue. Use this as the QueueName dimension in CloudWatch SQS metric alarms."
  value       = aws_sqs_queue.dlq.name
}
