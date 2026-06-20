resource "aws_scheduler_schedule" "this" {
  name = "${var.name}-${var.environment}-release-expired"

  schedule_expression          = var.schedule_expression
  schedule_expression_timezone = var.scheduler_timezone

  flexible_time_window {
    mode = "OFF"
  }

  target {
    arn      = var.target_queue_arn
    role_arn = var.scheduler_role_arn
    input    = var.target_message
  }
}
