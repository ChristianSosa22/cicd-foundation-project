# ── SNS Topic (alert sink) ────────────────────────────────────────────────────

resource "aws_sns_topic" "alerts" {
  name = "${var.name}-${var.environment}-alerts"

  tags = {
    Environment = var.environment
    Project     = var.name
    ManagedBy   = "terraform"
  }
}

# Email subscription — recipient must click the confirmation link sent by AWS
# after the first apply before notifications are delivered.
resource "aws_sns_topic_subscription" "email" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# ── Observability log group ───────────────────────────────────────────────────
# A dedicated log group for platform-level observability logs (e.g. custom
# metric filter sources, centralised audit logs). Separate from the ECS task
# log groups managed by the compute module.

resource "aws_cloudwatch_log_group" "app" {
  name              = "/observability/${var.name}-${var.environment}/app"
  retention_in_days = var.log_retention_days

  tags = {
    Environment = var.environment
    Project     = var.name
    ManagedBy   = "terraform"
  }
}
