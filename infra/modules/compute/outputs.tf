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


