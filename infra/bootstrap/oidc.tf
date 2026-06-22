# ── GitHub Actions OIDC Federation ────────────────────────────────────────────
# Allows GitHub Actions workflows to obtain short-lived AWS credentials by
# assuming IAM roles — no long-lived access keys stored in GitHub Secrets.
#
# Run this via the bootstrap config (local state) before any CI pipeline runs:
#   cd infra/bootstrap
#   terraform init
#   terraform apply -var-file=envs/dev/dev.tfvars
#
# After apply, copy the output role ARNs into GitHub:
#   - Environment 'dev'        → variable AWS_DEPLOY_ROLE_ARN = gha_deploy_dev_role_arn
#   - Environment 'staging'    → variable AWS_DEPLOY_ROLE_ARN = gha_deploy_staging_role_arn
#   - Environment 'production' → variable AWS_DEPLOY_ROLE_ARN = gha_deploy_prod_role_arn
#   - Repo-level               → variable AWS_DEPLOY_ROLE_ARN_DEV  = gha_deploy_dev_role_arn
#   - Repo-level               → variable AWS_DEPLOY_ROLE_ARN_PROD = gha_deploy_prod_role_arn

locals {
  repo_ref = "${var.github_org}/${var.github_repo}"
}

# GitHub's OIDC provider (one per AWS account — idempotent if it already exists).
resource "aws_iam_openid_connect_provider" "github_actions" {
  url = "https://token.actions.githubusercontent.com"

  # The audience GitHub tokens present to AWS.
  client_id_list = ["sts.amazonaws.com"]

  # GitHub OIDC CA thumbprint (2023 intermediate certificate, 40 hex chars).
  # AWS now auto-validates GitHub tokens regardless of thumbprint, but the
  # provider requires at least one valid 40-character SHA-1 value in the list.
  thumbprint_list = ["1c58a3a8518e8759bf075b76b750d4f2df264fcd"]

  tags = {
    Purpose   = "github-actions-oidc"
    ManagedBy = "terraform"
  }
}

# ── Deploy role: dev ──────────────────────────────────────────────────────────
resource "aws_iam_role" "gha_deploy_dev" {
  name = "gha-deploy-dev"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        # Used by deploy-dev job (environment: dev) on PR merge.
        Sid       = "AllowDevEnvironment"
        Effect    = "Allow"
        Principal = { Federated = aws_iam_openid_connect_provider.github_actions.arn }
        Action    = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
            "token.actions.githubusercontent.com:sub" = "repo:${local.repo_ref}:environment:dev"
          }
        }
      },
      {
        # Used by scheduled/dispatch jobs (drift detection) running on main.
        # These have no GitHub Environment context, so they match ref:refs/heads/main.
        Sid       = "AllowMainBranch"
        Effect    = "Allow"
        Principal = { Federated = aws_iam_openid_connect_provider.github_actions.arn }
        Action    = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
            "token.actions.githubusercontent.com:sub" = "repo:${local.repo_ref}:ref:refs/heads/main"
          }
        }
      },
    ]
  })

  tags = {
    Purpose     = "gha-deploy"
    Environment = "dev"
    ManagedBy   = "terraform"
  }
}

# ── Deploy role: staging ───────────────────────────────────────────────────────
resource "aws_iam_role" "gha_deploy_staging" {
  name = "gha-deploy-staging"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        # Used by deploy-staging job (environment: staging) — gated by the
        # GitHub Environment's required-reviewer protection rule.
        Sid       = "AllowStagingEnvironment"
        Effect    = "Allow"
        Principal = { Federated = aws_iam_openid_connect_provider.github_actions.arn }
        Action    = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
            "token.actions.githubusercontent.com:sub" = "repo:${local.repo_ref}:environment:staging"
          }
        }
      },
      {
        # Used by scheduled/dispatch jobs (drift detection) running on main.
        Sid       = "AllowMainBranch"
        Effect    = "Allow"
        Principal = { Federated = aws_iam_openid_connect_provider.github_actions.arn }
        Action    = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
            "token.actions.githubusercontent.com:sub" = "repo:${local.repo_ref}:ref:refs/heads/main"
          }
        }
      },
    ]
  })

  tags = {
    Purpose     = "gha-deploy"
    Environment = "staging"
    ManagedBy   = "terraform"
  }
}

# ── Deploy role: production ────────────────────────────────────────────────────
resource "aws_iam_role" "gha_deploy_prod" {
  name = "gha-deploy-prod"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        # Used by deploy-prod and destroy jobs (environment: production) — gated
        # by the GitHub Environment's required-reviewer protection rule.
        Sid       = "AllowProductionEnvironment"
        Effect    = "Allow"
        Principal = { Federated = aws_iam_openid_connect_provider.github_actions.arn }
        Action    = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
            "token.actions.githubusercontent.com:sub" = "repo:${local.repo_ref}:environment:prod"
          }
        }
      },
      {
        # Used by scheduled drift detection from the main branch.
        Sid       = "AllowMainBranch"
        Effect    = "Allow"
        Principal = { Federated = aws_iam_openid_connect_provider.github_actions.arn }
        Action    = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
            "token.actions.githubusercontent.com:sub" = "repo:${local.repo_ref}:ref:refs/heads/main"
          }
        }
      },
    ]
  })

  tags = {
    Purpose     = "gha-deploy"
    Environment = "production"
    ManagedBy   = "terraform"
  }
}

# Permissions: Terraform manages a full AWS stack (ECS, RDS, VPC, ALB, S3, SQS,
# ECR, IAM, EventBridge, SSM, CloudWatch). AdministratorAccess is used here for
# simplicity — tighten to a least-privilege custom policy before moving to a
# shared/production AWS account.
resource "aws_iam_role_policy_attachment" "gha_deploy_dev_admin" {
  role       = aws_iam_role.gha_deploy_dev.name
  policy_arn = "arn:aws:iam::aws:policy/AdministratorAccess"
}

resource "aws_iam_role_policy_attachment" "gha_deploy_staging_admin" {
  role       = aws_iam_role.gha_deploy_staging.name
  policy_arn = "arn:aws:iam::aws:policy/AdministratorAccess"
}

resource "aws_iam_role_policy_attachment" "gha_deploy_prod_admin" {
  role       = aws_iam_role.gha_deploy_prod.name
  policy_arn = "arn:aws:iam::aws:policy/AdministratorAccess"
}
