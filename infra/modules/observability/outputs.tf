output "sns_topic_arn" {
  description = "ARN of the SNS alerts topic. Wire this into other modules (e.g. iam module's sns_topic_arn placeholder) or additional alarm_actions."
  value       = aws_sns_topic.alerts.arn
}

output "alarm_arns" {
  description = "ARNs of all CloudWatch metric alarms created by this module. Useful for referencing in IAM policies or composite alarms."
  value = [
    aws_cloudwatch_metric_alarm.api_5xx.arn,
    aws_cloudwatch_metric_alarm.release_dlq.arn,
  ]
}

output "dashboard_name" {
  description = "Name of the CloudWatch dashboard. Use this to construct the console URL: https://console.aws.amazon.com/cloudwatch/home#dashboards:name=<value>."
  value       = aws_cloudwatch_dashboard.main.dashboard_name
}

output "budget_name" {
  description = "Name of the AWS Budget. Use this to verify budget creation and threshold notifications in the AWS Billing console."
  value       = aws_budgets_budget.monthly.name
}

output "log_group_name" {
  description = "Name of the observability CloudWatch log group. Use this as the destination for custom metric filters or centralised audit log shipping."
  value       = aws_cloudwatch_log_group.app.name
}
