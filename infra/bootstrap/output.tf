output "state_bucket_name" {
  value       = aws_s3_bucket.tfstate.id
  description = "Name of the S3 bucket storing remote Terraform state."
}

output "state_bucket_arn" {
  value       = aws_s3_bucket.tfstate.arn
  description = "ARN of the S3 bucket storing remote Terraform state."
}

output "lock_table_name" {
  value       = aws_dynamodb_table.tfstate_lock.name
  description = "Name of the DynamoDB table used for Terraform state locking."
}

output "lock_table_arn" {
  value       = aws_dynamodb_table.tfstate_lock.arn
  description = "ARN of the DynamoDB table used for Terraform state locking."
}

output "region" {
  value       = var.region
  description = "AWS region where the remote state backend resources live."
}

# ── GitHub OIDC role ARNs ──────────────────────────────────────────────────────
# Copy these values into GitHub after running: terraform apply -var-file=envs/dev/dev.tfvars
#
# GitHub setup (run once — requires repo admin):
#
#   # Create environments
#   gh api repos/<org>/<repo>/environments/dev         -X PUT -H "Accept: application/vnd.github+json" --input /dev/null
#   gh api repos/<org>/<repo>/environments/staging     -X PUT -H "Accept: application/vnd.github+json" --input /dev/null
#   gh api repos/<org>/<repo>/environments/production  -X PUT -H "Accept: application/vnd.github+json" --input /dev/null
#
#   # Required reviewers on staging and prod (UI only, or via API):
#   # Settings → Environments → staging → Required reviewers → ChristianSosa22, analopez-24, Pablokill2004
#   # Settings → Environments → prod    → Required reviewers → ChristianSosa22, analopez-24, Pablokill2004
#
#   # Set env-scoped variables (role-to-assume per environment)
#   gh variable set AWS_DEPLOY_ROLE_ARN --env dev        --body "<gha_deploy_dev_role_arn>"
#   gh variable set AWS_DEPLOY_ROLE_ARN --env staging    --body "<gha_deploy_staging_role_arn>"
#   gh variable set AWS_DEPLOY_ROLE_ARN --env production --body "<gha_deploy_prod_role_arn>"
#   gh variable set AWS_REGION          --env dev        --body "us-east-1"
#   gh variable set AWS_REGION          --env staging    --body "us-east-1"
#   gh variable set AWS_REGION          --env production --body "us-east-1"
#
#   # Set env-scoped secrets — namespaced per environment, NOT repo-level
#   gh secret set DEV_DB_PASSWORD     --env dev        --body "<dev-db-password>"
#   gh secret set STAGING_DB_PASSWORD --env staging    --body "<staging-db-password>"
#
#   # Set repo-level variables (used by drift-detection jobs, which bypass env gates)
#   gh variable set AWS_DEPLOY_ROLE_ARN_DEV  --body "<gha_deploy_dev_role_arn>"
#   gh variable set AWS_DEPLOY_ROLE_ARN_PROD --body "<gha_deploy_prod_role_arn>"
#   gh variable set AWS_REGION               --body "us-east-1"
#
#   # Set repo-level secrets for drift detection
#   gh secret set DB_PASSWORD_DEV  --body "<dev-db-password>"
#   gh secret set DB_PASSWORD_PROD --body "<prod-db-password>"
#
#   # Branch ruleset on main (require PR + passing 'plan' check + no force-push)
#   # Apply the ruleset JSON from infra/docs/main-ruleset.json:
#   gh api repos/<org>/<repo>/rulesets -X POST --input infra/docs/main-ruleset.json

output "gha_deploy_dev_role_arn" {
  value       = aws_iam_role.gha_deploy_dev.arn
  description = "ARN of the IAM role assumed by GitHub Actions for dev deployments. Set as AWS_DEPLOY_ROLE_ARN in the 'dev' GitHub Environment and as AWS_DEPLOY_ROLE_ARN_DEV at repo level."
}

output "gha_deploy_staging_role_arn" {
  value       = aws_iam_role.gha_deploy_staging.arn
  description = "ARN of the IAM role assumed by GitHub Actions for staging deployments. Set as AWS_DEPLOY_ROLE_ARN in the 'staging' GitHub Environment."
}

output "gha_deploy_prod_role_arn" {
  value       = aws_iam_role.gha_deploy_prod.arn
  description = "ARN of the IAM role assumed by GitHub Actions for production deployments. Set as AWS_DEPLOY_ROLE_ARN in the 'production' GitHub Environment and as AWS_DEPLOY_ROLE_ARN_PROD at repo level."
}
