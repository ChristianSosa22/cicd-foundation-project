# ── Naming / tagging ──────────────────────────────────────────────────────────

variable "name" {
  description = "Logical project name used as a prefix for all observability resource names (e.g. oyd-project)."
  type        = string
}

variable "environment" {
  description = "Deployment environment (e.g. dev, prod). Combined with name to form resource name prefixes."
  type        = string
}

variable "region" {
  description = "AWS region in which observability resources are created. Used as the CloudWatch region inside dashboard widgets."
  type        = string
}

# ── Notifications ─────────────────────────────────────────────────────────────

variable "alert_email" {
  description = "Email address that receives SNS alarm and budget notifications. Must confirm the subscription after the first apply."
  type        = string
}

# ── Log retention ─────────────────────────────────────────────────────────────

variable "log_retention_days" {
  description = "Number of days to retain logs in the observability CloudWatch log group. Common values: 30 (dev), 90 (prod)."
  type        = number
}

# ── Budget ────────────────────────────────────────────────────────────────────

variable "monthly_budget_limit" {
  description = "Monthly AWS cost budget limit in USD (string, e.g. \"30\"). Alerts fire at 80 % forecasted and 100 % actual spend."
  type        = string
}

# ── ALB alarm dimensions ──────────────────────────────────────────────────────

variable "alb_arn_suffix" {
  description = "ARN suffix of the Application Load Balancer (aws_lb.arn_suffix). Used as the LoadBalancer dimension in ALB CloudWatch metric alarms and dashboard widgets."
  type        = string
}

variable "api_target_group_arn_suffix" {
  description = "ARN suffix of the API ALB target group (aws_lb_target_group.arn_suffix). Used as the TargetGroup dimension in ALB CloudWatch metric alarms."
  type        = string
}

# ── SQS DLQ alarm dimension ───────────────────────────────────────────────────

variable "release_dlq_name" {
  description = "Name of the release dead-letter SQS queue. Used as the QueueName dimension in the DLQ CloudWatch alarm."
  type        = string
}
