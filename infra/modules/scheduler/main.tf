resource "aws_iam_role" "scheduler" {
  name = "${var.name}-${var.environment}-scheduler-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "scheduler.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = {
    Environment = var.environment
    Project     = var.name
    ManagedBy   = "terraform"
  }
}

resource "aws_iam_role_policy" "scheduler_sqs" {
  name = "${var.name}-${var.environment}-scheduler-sqs"
  role = aws_iam_role.scheduler.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["sqs:SendMessage"]
      Resource = var.target_queue_arn
    }]
  })
}

resource "aws_scheduler_schedule" "this" {
  name = "${var.name}-${var.environment}-release-expired"

  schedule_expression          = var.schedule_expression
  schedule_expression_timezone = var.scheduler_timezone

  flexible_time_window {
    mode = "OFF"
  }

  target {
    arn      = var.target_queue_arn
    role_arn = aws_iam_role.scheduler.arn
    input    = var.target_message
  }
}
