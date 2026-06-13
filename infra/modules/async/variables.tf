variable "name" {
  description = "Project name prefix. Used in resource tags for traceability."
  type        = string
}

variable "environment" {
  description = "Deployment environment name (e.g., dev, staging, prod). Used in resource tags."
  type        = string
}

variable "queue_name_prefix" {
  description = "Base name for the SQS queue and its DLQ. The module appends '-queue' and '-dlq' respectively. Example: 'oyd-project-dev-receipt' produces 'oyd-project-dev-receipt-queue' and 'oyd-project-dev-receipt-dlq'."
  type        = string
}

variable "visibility_timeout_seconds" {
  description = "Duration (in seconds) during which a received message is invisible to other consumers. Should be longer than the expected processing time to avoid duplicate processing. Example: 60."
  type        = number
}

variable "message_retention_seconds" {
  description = "Number of seconds Amazon SQS retains a message before discarding it if not consumed. Minimum: 60 (1 minute), Maximum: 1209600 (14 days). Example: 345600 (4 days)."
  type        = number
}

variable "max_receive_count" {
  description = "Maximum number of times a message can be received from the main queue before being moved to the DLQ. A value of 3 is typical for absorbing transient failures without excessive retries."
  type        = number
}

variable "dlq_message_retention_seconds" {
  description = "Number of seconds messages are retained in the DLQ before being discarded. Should be longer than the main queue to allow manual inspection and redrive. Example: 1209600 (14 days)."
  type        = number
}
