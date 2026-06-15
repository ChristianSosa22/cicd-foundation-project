output "instance_id" {
  description = "EC2 instance ID of the SSM jump host. Pass to 'aws ssm start-session --target' for RDS port forwarding."
  value       = aws_instance.ssm_jump.id
}
