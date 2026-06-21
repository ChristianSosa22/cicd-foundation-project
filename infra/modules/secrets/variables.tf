variable "name" {
  description = "Project name prefix used in SSM parameter paths. Example: oyd-project → path /oyd-project/dev/JWT_SECRET."
  type        = string
}

variable "environment" {
  description = "Deployment environment name (e.g., dev, staging, prod). Included as the second segment of every SSM parameter path."
  type        = string
}

variable "kms_key_id" {
  description = "KMS key ARN or ID for encrypting SSM SecureString parameters and Secrets Manager secrets. Leave empty to use the AWS managed default key."
  type        = string
  default     = ""
}

variable "db_password" {
  description = "Master password for the RDS instance. Required only on the initial apply to seed the Secrets Manager secret; leave empty on subsequent runs (lifecycle ignore_changes prevents overwrites). Supply via TF_VAR_db_password — never commit this value."
  type        = string
  sensitive   = true
  default     = ""
}
