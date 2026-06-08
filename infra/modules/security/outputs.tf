output "web_security_group_id" {
  description = "ID of the web/ALB tier security group (public-facing, HTTP/HTTPS)."
  value       = aws_security_group.web.id
}

output "app_security_group_id" {
  description = "ID of the application tier security group (API service, ingress from web-sg)."
  value       = aws_security_group.app.id
}

output "web_service_security_group_id" {
  description = "ID of the web service tier security group (Next.js service, ingress from web-sg)."
  value       = aws_security_group.web_service.id
}

output "db_security_group_id" {
  description = "ID of the database tier security group (RDS, ingress from app-sg only)."
  value       = aws_security_group.db.id
}
