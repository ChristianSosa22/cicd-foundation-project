variable "project_name" {
  description = "Logical name of the project. Used as a prefix in all IAM role names (e.g., oyd-project)."
  type        = string
}

variable "environment" {
  description = "Deployment environment name (e.g., dev, staging, prod). Suffix in all IAM role names."
  type        = string
}

variable "region" {
  description = "AWS region in which resources are created. Used in ARN construction for policies."
  type        = string
  default     = "us-east-1"
}

variable "receipts_bucket_arn" {
  description = "ARN of the S3 receipts bucket. Granted to the compute task role (Get/Put) and the receipt consumer role (PutObject)."
  type        = string
}

variable "rds_instance_arn" {
  description = "ARN of the RDS database instance. Granted to the compute task role via rds-db:connect for future IAM auth."
  type        = string
}

variable "db_username" {
  description = "Database master username. Combined with rds_instance_arn to form the rds-db:connect resource ARN."
  type        = string
}

variable "receipt_queue_arn" {
  description = "ARN of the receipt SQS queue. Granted to compute task (SendMessage) and receipt consumer (Receive/Delete/GetAttributes)."
  type        = string
}

variable "release_queue_arn" {
  description = "ARN of the release SQS queue. Granted to scheduler (SendMessage) and release consumer (Receive/Delete/GetAttributes)."
  type        = string
}

variable "email_queue_arn" {
  description = "ARN of the email SQS queue. Granted to email consumer role (Receive/Delete/GetAttributes). Also used for SNS→SQS subscription."
  type        = string
}

variable "kms_key_arn" {
  description = "ARN of the KMS CMK. If set, grants kms:Decrypt and kms:GenerateDataKey to the compute task role."
  type        = string
  default     = ""
}

variable "db_password_secret_arn" {
  description = "ARN of the Secrets Manager secret holding the RDS master password. Grants secretsmanager:GetSecretValue to the compute task role so the app can fetch the password at runtime."
  type        = string
  default     = ""
}

variable "github_repo" {
  description = "GitHub repository in org/repo format for the OIDC CI runner role trust policy subject claim. Example: ChristianSosa22/cicd-foundation-project."
  type        = string
}

variable "oidc_provider_arn" {
  description = "ARN of the GitHub Actions OIDC provider. If empty, the CI runner role trust policy uses a placeholder principal (provisioned by Estudiante B via Deliverable C)."
  type        = string
  default     = ""
}

variable "oidc_audience" {
  description = "OIDC audience claim value for the GitHub Actions trust policy. Defaults to the AWS STS standard value."
  type        = string
  default     = "token.actions.githubusercontent.com"
}
