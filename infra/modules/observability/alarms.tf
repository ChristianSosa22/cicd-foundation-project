# ── Alert 1: API 5xx error rate spike ────────────────────────────────────────
# Fires when the API target group returns more than 5 HTTP 5xx responses in
# a 5-minute rolling window (5 × 60-second periods). During morning peak
# (7–9 AM) even a handful of 5xx errors blocks users from reserving spaces.

resource "aws_cloudwatch_metric_alarm" "api_5xx" {
  alarm_name          = "${var.name}-${var.environment}-api-5xx-spike"
  alarm_description   = "API target group returned > 5 HTTP 5xx responses in the last 5 minutes. Engineering notification required — 5xx during morning peak blocks parking reservations."
  namespace           = "AWS/ApplicationELB"
  metric_name         = "HTTPCode_Target_5XX_Count"
  statistic           = "Sum"
  period              = 60
  evaluation_periods  = 5
  threshold           = 5
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    LoadBalancer = var.alb_arn_suffix
    TargetGroup  = var.api_target_group_arn_suffix
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]

  tags = {
    Environment = var.environment
    Project     = var.name
    ManagedBy   = "terraform"
  }
}

# ── Alert 2: Release DLQ receives a message ───────────────────────────────────
# Fires as soon as one message lands in the release dead-letter queue.
# A message here means that neither the EventBridge Scheduler path nor the
# in-process cron succeeded in releasing expired reservations — spaces remain
# marked as occupied for the rest of the day.

resource "aws_cloudwatch_metric_alarm" "release_dlq" {
  alarm_name          = "${var.name}-${var.environment}-release-dlq-message"
  alarm_description   = "CRITICAL: the release DLQ contains at least one message. Expired reservations are NOT being released — parking spaces will remain occupied indefinitely until the DLQ is redriven."
  namespace           = "AWS/SQS"
  metric_name         = "ApproximateNumberOfMessagesVisible"
  statistic           = "Maximum"
  period              = 60
  evaluation_periods  = 5
  threshold           = 0
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    QueueName = var.release_dlq_name
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]

  tags = {
    Environment = var.environment
    Project     = var.name
    ManagedBy   = "terraform"
  }
}
