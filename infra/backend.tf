terraform {
  backend "s3" {
    bucket         = "cicd-foundation-project"
    key            = "infra/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "cicd-foundation-project-lock"
    encrypt        = true
  }
}

