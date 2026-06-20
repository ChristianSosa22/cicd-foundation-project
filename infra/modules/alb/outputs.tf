output "alb_arn" {
  description = "ARN of the Application Load Balancer."
  value       = aws_lb.this.arn
}

output "alb_dns_name" {
  description = "Public DNS name of the ALB. This is the entry point for the whole application; hit http://<this> to reach the web frontend and /api, /availability, /reservar for the backend."
  value       = aws_lb.this.dns_name
}

output "alb_url" {
  description = "Convenience HTTP URL of the ALB (http://<dns_name>). Use this in curl evidence and as the public base URL."
  value       = "http://${aws_lb.this.dns_name}"
}

output "alb_zone_id" {
  description = "Canonical hosted zone ID of the ALB. Use this to create a Route 53 alias record in a future iteration."
  value       = aws_lb.this.zone_id
}

output "api_target_group_arn" {
  description = "ARN of the API target group. Wire this into the API ECS service's load_balancer block so Fargate registers task IPs."
  value       = aws_lb_target_group.api.arn
}

output "web_target_group_arn" {
  description = "ARN of the web target group. Wire this into the web ECS service's load_balancer block so Fargate registers task IPs."
  value       = aws_lb_target_group.web.arn
}

# ── TLS / HTTPS Outputs ───────────────────────────────────────────────────────

output "acm_certificate_arn" {
  description = "ARN of the ACM certificate (only when enable_tls is true). Used to verify the certificate was provisioned and validated."
  value       = var.enable_tls ? aws_acm_certificate.this[0].arn : ""
}

output "acm_certificate_domain" {
  description = "Domain name on the ACM certificate (only when enable_tls is true)."
  value       = var.enable_tls ? aws_acm_certificate.this[0].domain_name : ""
}

output "alb_https_url" {
  description = "Public HTTPS URL of the application (https://<app_fqdn>). Use this in curl evidence for TLS verification."
  value       = var.enable_tls ? "https://${var.app_fqdn}" : ""
}

output "app_fqdn" {
  description = "Fully-qualified domain name of the application (Route 53 alias record). The canonical public URL for the application."
  value       = var.enable_tls ? var.app_fqdn : ""
}

output "alb_https_listener_arn" {
  description = "ARN of the HTTPS:443 listener (only when enable_tls is true). Useful for referencing in future listener rules."
  value       = var.enable_tls ? aws_lb_listener.https[0].arn : ""
}

output "route53_zone_id" {
  description = "Route 53 hosted zone ID (only when enable_tls is true). Useful for adding additional DNS records."
  value       = var.enable_tls ? data.aws_route53_zone.this[0].zone_id : ""
}

# ── CloudWatch alarm dimensions ───────────────────────────────────────────────

output "alb_arn_suffix" {
  description = "ARN suffix of the ALB (e.g. app/my-alb/1234abcd). Use this as the LoadBalancer dimension in CloudWatch ALB metric alarms and dashboard widgets."
  value       = aws_lb.this.arn_suffix
}

output "api_target_group_arn_suffix" {
  description = "ARN suffix of the API target group (e.g. targetgroup/my-tg/1234abcd). Use this as the TargetGroup dimension in CloudWatch ALB metric alarms."
  value       = aws_lb_target_group.api.arn_suffix
}