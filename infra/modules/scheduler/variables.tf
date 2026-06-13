variable "name" {
  description = "Project name prefix. Used in resource names and tags."
  type        = string
}

variable "environment" {
  description = "Deployment environment name (e.g., dev, staging, prod). Used in resource names and tags."
  type        = string
}

variable "schedule_expression" {
  description = "EventBridge Scheduler expression defining how often the schedule fires. Accepts cron or rate expressions. Example: 'rate(20 minutes)' for periodic expired-reservation sweeps."
  type        = string
}

variable "scheduler_timezone" {
  description = "IANA timezone for the schedule expression. Determines when cron-based schedules fire relative to local time. Example: 'America/Guatemala' for Central America business hours."
  type        = string
}

variable "target_queue_arn" {
  description = "ARN of the SQS queue that receives the scheduled messages. The scheduler role is granted sqs:SendMessage scoped exclusively to this ARN — no wildcard."
  type        = string
}

variable "target_message" {
  description = "JSON message body sent to the target SQS queue on each scheduled invocation. Must conform to the ReleaseExpiredReservationCommand payload contract defined in the project documentation."
  type        = string
}
