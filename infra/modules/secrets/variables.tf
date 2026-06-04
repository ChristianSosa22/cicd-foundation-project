variable "name" {
  description = "Project name prefix used in SSM parameter paths. Example: oyd-project → path /oyd-project/dev/JWT_SECRET."
  type        = string
}

variable "environment" {
  description = "Deployment environment name (e.g., dev, staging, prod). Included as the second segment of every SSM parameter path."
  type        = string
}

variable "kms_key_id" {
  description = "Optional KMS key ID or ARN for encrypting SSM SecureString parameters. Leave empty to use the default AWS managed key (alias/aws/ssm), which is free."
  type        = string
  default     = ""
}
