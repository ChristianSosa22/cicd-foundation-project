variable "region" {
  type        = string
  description = "AWS region for the remote state backend resources."
  default     = "us-east-1"
}

variable "state_bucket_name" {
  type        = string
  description = "Globally unique name of the S3 bucket that will store Terraform remote state."
}

variable "lock_table_name" {
  type        = string
  description = "Name of the DynamoDB table used for Terraform state locking. Must have a string hash key named LockID."
}

# ── GitHub OIDC federation ────────────────────────────────────────────────────

variable "github_org" {
  type        = string
  description = "GitHub organization or username that owns the repository. Used to scope OIDC trust policies so only workflows from this repo can assume the deploy roles."
  default     = "ChristianSosa22"
}

variable "github_repo" {
  type        = string
  description = "GitHub repository name (without the org prefix). Used together with github_org to form the OIDC sub claim: repo:<org>/<repo>:environment:<env>."
  default     = "cicd-foundation-project"
}
