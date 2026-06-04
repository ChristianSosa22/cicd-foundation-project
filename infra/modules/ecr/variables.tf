variable "name" {
  description = "Project name prefix used to name the ECR repositories (e.g. oyd-project)."
  type        = string
}

variable "environment" {
  description = "Deployment environment name (e.g., dev, staging, prod)."
  type        = string
}

variable "image_tag_mutability" {
  description = "Image tag mutability setting for the repositories. MUTABLE allows re-tagging (convenient for dev). IMMUTABLE enforces unique tags per image (recommended for production)."
  type        = string
  default     = "MUTABLE"
}

variable "untagged_image_retention_days" {
  description = "Number of days after which untagged images are automatically expired by the ECR lifecycle policy. Keeps repository storage costs low."
  type        = number
  default     = 14
}
