# Partial S3 backend configuration — the state key is NOT defined here.
# Supply it at init time with: terraform init -backend-config=envs/<env>/backend.hcl
# This keeps dev and prod state completely isolated under different S3 keys
# while sharing the same bucket and DynamoDB lock table.
#
# One-time migration (run once before switching to the new pipeline):
#   aws s3 cp s3://cicd-foundation-project/infra/terraform.tfstate \
#             s3://cicd-foundation-project/env/dev/terraform.tfstate
#   Then: terraform init -migrate-state -backend-config=envs/dev/backend.hcl
terraform {
  backend "s3" {
    bucket         = "cicd-foundation-project"
    region         = "us-east-1"
    dynamodb_table = "cicd-foundation-project-lock"
    encrypt        = true
  }
}

