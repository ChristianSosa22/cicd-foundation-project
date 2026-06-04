# ECR repository for the API service (Node/Express backend, port 8080)
resource "aws_ecr_repository" "api" {
  name                 = "${var.name}-api"
  image_tag_mutability = var.image_tag_mutability

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "AES256"
  }

  tags = {
    Environment = var.environment
    Project     = var.name
    Service     = "api"
    ManagedBy   = "terraform"
  }
}

# ECR repository for the web frontend service (Next.js standalone, port 3000)
resource "aws_ecr_repository" "web" {
  name                 = "${var.name}-web"
  image_tag_mutability = var.image_tag_mutability

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "AES256"
  }

  tags = {
    Environment = var.environment
    Project     = var.name
    Service     = "web"
    ManagedBy   = "terraform"
  }
}

# Lifecycle policies: automatically expire untagged images to control storage costs
resource "aws_ecr_lifecycle_policy" "api" {
  repository = aws_ecr_repository.api.name

  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Expire untagged images older than ${var.untagged_image_retention_days} days"
      selection = {
        tagStatus   = "untagged"
        countType   = "sinceImagePushed"
        countUnit   = "days"
        countNumber = var.untagged_image_retention_days
      }
      action = { type = "expire" }
    }]
  })
}

resource "aws_ecr_lifecycle_policy" "web" {
  repository = aws_ecr_repository.web.name

  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Expire untagged images older than ${var.untagged_image_retention_days} days"
      selection = {
        tagStatus   = "untagged"
        countType   = "sinceImagePushed"
        countUnit   = "days"
        countNumber = var.untagged_image_retention_days
      }
      action = { type = "expire" }
    }]
  })
}
