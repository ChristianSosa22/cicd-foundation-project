output "cluster_arn" {
  description = "ARN of the ECS cluster. Use this to reference the cluster from other resources."
  value       = aws_ecs_cluster.this.arn
}

output "cluster_name" {
  description = "Name of the ECS cluster as it appears in AWS."
  value       = aws_ecs_cluster.this.name
}

output "task_definition_arn" {
  description = "ARN of the ECS task definition. Use this to deploy or update the service."
  value       = aws_ecs_task_definition.this.arn
}