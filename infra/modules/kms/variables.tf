variable "project_name" {
  description = "Logical name of the project. Used in key description and tags."
  type        = string
}

variable "environment" {
  description = "Deployment environment (e.g., dev, staging, prod). Used in key description and tags."
  type        = string
}

variable "kms_key_alias" {
  description = "KMS alias name (without the 'alias/' prefix). Example: myproject-dev-cmk."
  type        = string
}

variable "key_deletion_window_in_days" {
  description = "Waiting period in days before the CMK is deleted after a destroy. Valid range: 7–30."
  type        = number
  default     = 7
}
