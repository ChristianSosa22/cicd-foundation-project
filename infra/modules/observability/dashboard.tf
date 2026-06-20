# ── CloudWatch Dashboard ──────────────────────────────────────────────────────
# Dynamic dashboard: all metric dimensions are interpolated from module
# variables so the same module can be instantiated for dev, staging, or prod
# without hardcoding ARN suffixes or queue names.
#
# Layout (24-column CloudWatch grid, 6 rows per band):
#   Row 0: API error rates (5xx / 4xx)          | API request volume
#   Row 6: API response time (p50 / p95 / p99)  | Release DLQ depth

resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "${var.name}-${var.environment}-dashboard"

  dashboard_body = jsonencode({
    widgets = [

      # ── Widget 1: API HTTP error rates ──────────────────────────────────────
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6
        properties = {
          title  = "API HTTP Error Rates (5xx / 4xx)"
          region = var.region
          period = 60
          stat   = "Sum"
          view   = "timeSeries"
          metrics = [
            ["AWS/ApplicationELB", "HTTPCode_Target_5XX_Count",
              "LoadBalancer", var.alb_arn_suffix,
              "TargetGroup", var.api_target_group_arn_suffix,
              { "label" = "5xx", "color" = "#d62728" }
            ],
            ["AWS/ApplicationELB", "HTTPCode_Target_4XX_Count",
              "LoadBalancer", var.alb_arn_suffix,
              "TargetGroup", var.api_target_group_arn_suffix,
              { "label" = "4xx", "color" = "#ff7f0e" }
            ]
          ]
          annotations = {
            horizontal = [
              { value = 5, label = "5xx alarm threshold", color = "#d62728" }
            ]
          }
        }
      },

      # ── Widget 2: API request volume ─────────────────────────────────────────
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6
        properties = {
          title  = "API Request Volume"
          region = var.region
          period = 60
          stat   = "Sum"
          view   = "timeSeries"
          metrics = [
            ["AWS/ApplicationELB", "RequestCount",
              "LoadBalancer", var.alb_arn_suffix,
              { "label" = "Total requests/min" }
            ]
          ]
        }
      },

      # ── Widget 3: API response time percentiles ───────────────────────────────
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 12
        height = 6
        properties = {
          title  = "API Response Time (p50 / p95 / p99)"
          region = var.region
          period = 60
          view   = "timeSeries"
          metrics = [
            ["AWS/ApplicationELB", "TargetResponseTime",
              "LoadBalancer", var.alb_arn_suffix,
              { "stat" = "p50", "label" = "p50", "color" = "#2ca02c" }
            ],
            ["AWS/ApplicationELB", "TargetResponseTime",
              "LoadBalancer", var.alb_arn_suffix,
              { "stat" = "p95", "label" = "p95", "color" = "#ff7f0e" }
            ],
            ["AWS/ApplicationELB", "TargetResponseTime",
              "LoadBalancer", var.alb_arn_suffix,
              { "stat" = "p99", "label" = "p99", "color" = "#d62728" }
            ]
          ]
          yAxis = { left = { label = "Seconds", min = 0 } }
        }
      },

      # ── Widget 4: Release DLQ depth ──────────────────────────────────────────
      {
        type   = "metric"
        x      = 12
        y      = 6
        width  = 12
        height = 6
        properties = {
          title  = "Release DLQ — Messages Visible"
          region = var.region
          period = 60
          stat   = "Maximum"
          view   = "timeSeries"
          metrics = [
            ["AWS/SQS", "ApproximateNumberOfMessagesVisible",
              "QueueName", var.release_dlq_name,
              { "label" = "Messages in DLQ", "color" = "#d62728" }
            ]
          ]
          annotations = {
            horizontal = [
              { value = 1, label = "DLQ alarm threshold", color = "#d62728" }
            ]
          }
        }
      }

    ]
  })
}
