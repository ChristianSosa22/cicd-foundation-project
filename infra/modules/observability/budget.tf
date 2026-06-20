# ── AWS Budget ────────────────────────────────────────────────────────────────
# Tracks total monthly AWS spend against a fixed USD limit.
# Two notifications:
#   • 80 % of forecasted spend → early warning, gives time to investigate.
#   • 100 % of actual spend   → budget exceeded, immediate action required.
# Both notify the same SNS-subscribed email address used for alarms.

resource "aws_budgets_budget" "monthly" {
  name         = "${var.name}-${var.environment}-monthly-budget"
  budget_type  = "COST"
  time_unit    = "MONTHLY"
  limit_amount = var.monthly_budget_limit
  limit_unit   = "USD"

  # Early warning: 80 % of the monthly forecast
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 80
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = [var.alert_email]
  }

  # Hard limit: 100 % of actual spend
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.alert_email]
  }
}
