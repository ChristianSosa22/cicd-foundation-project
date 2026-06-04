output "api_repository_url" {
  description = "Full ECR repository URL for the API image. Use this to tag and push images: docker tag <image> <url>:<tag>."
  value       = aws_ecr_repository.api.repository_url
}

output "web_repository_url" {
  description = "Full ECR repository URL for the web frontend image. Use this to tag and push images: docker tag <image> <url>:<tag>."
  value       = aws_ecr_repository.web.repository_url
}

output "api_repository_name" {
  description = "Short name of the API ECR repository (without the registry prefix)."
  value       = aws_ecr_repository.api.name
}

output "web_repository_name" {
  description = "Short name of the web ECR repository (without the registry prefix)."
  value       = aws_ecr_repository.web.name
}
