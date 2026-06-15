output "cluster_arn" {
  description = "ARN of the ECS cluster."
  value       = aws_ecs_cluster.this.arn
}

output "cluster_name" {
  description = "Name of the ECS cluster as it appears in the AWS console."
  value       = aws_ecs_cluster.this.name
}

output "api_task_definition_arn" {
  description = "ARN of the API task definition. Use this for deployments and rollbacks."
  value       = aws_ecs_task_definition.api.arn
}

output "web_task_definition_arn" {
  description = "ARN of the web task definition. Use this for deployments and rollbacks."
  value       = aws_ecs_task_definition.web.arn
}

output "api_service_name" {
  description = "Name of the ECS service running the API. Wire this into the ALB target group in the follow-up task."
  value       = aws_ecs_service.api.name
}

output "web_service_name" {
  description = "Name of the ECS service running the web frontend. Wire this into the ALB target group in the follow-up task."
  value       = aws_ecs_service.web.name
}



output "worker_task_definition_arn" {
  description = "ARN of the async worker task definition. Use this for deployments and rollbacks of the SQS consumer."
  value       = aws_ecs_task_definition.worker.arn
}

output "worker_service_name" {
  description = "Name of the ECS service running the async SQS consumer worker."
  value       = aws_ecs_service.worker.name
}

output "worker_task_role_arn" {
  description = "ARN of the dedicated worker task role, scoped to sqs receive/delete on the receipt queue and s3:PutObject on the receipts bucket."
  value       = aws_iam_role.worker_task.arn
}
