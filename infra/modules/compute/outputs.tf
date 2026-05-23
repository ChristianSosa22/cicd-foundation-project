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

output "ecs_tasks_sg_id" {
  description = "ID of the ECS tasks security group. Reference this as the ingress source on the RDS security group."
  value       = aws_security_group.ecs_tasks.id
}