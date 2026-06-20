variable "name" {
  description = "Project name prefix used to name the ALB, target groups, and security group (e.g. oyd-project)."
  type        = string
}

variable "environment" {
  description = "Deployment environment name (e.g., dev, staging, prod). Included in resource names and tags."
  type        = string
}

variable "vpc_id" {
  description = "ID of the VPC where the ALB security group and target groups are created. Must be the custom VPC from the network module."
  type        = string
}

variable "public_subnet_ids" {
  description = "List of public subnet IDs (one per AZ) where the internet-facing ALB places its nodes. Provided by network module output public_subnet_ids."
  type        = list(string)
}

variable "security_group_id" {
  description = "Security group ID for the ALB, provided by the security module (the public-facing web/ALB tier SG with HTTP/HTTPS ingress). The ALB module no longer creates its own SG; it reuses this one to keep the chained-SG design centralized in the security module."
  type        = string
}

variable "api_port" {
  description = "Container/target port of the API service (Node/Express backend). Must match the API task definition portMapping."
  type        = number
  default     = 8080
}

variable "web_port" {
  description = "Container/target port of the web service (Next.js standalone). Must match the web task definition portMapping."
  type        = number
  default     = 3000
}

variable "health_check_path" {
  description = "Path used by the ALB target group health check for the WEB service. Required by the delivery spec to default to '/'. The API target group uses a dedicated readiness path (api_health_check_path)."
  type        = string
  default     = "/"
}

variable "api_health_check_path" {
  description = "Path used by the ALB target group health check for the API service. The backend exposes /ready (DB-aware) and /health (liveness). Default /health keeps the check independent of DB state for ALB target health."
  type        = string
  default     = "/health"
}

variable "api_path_patterns" {
  description = "List of listener path patterns routed to the API target group. Everything not matching falls through to the web target group. All backend routes share the /api prefix so a single pattern covers them all."
  type        = list(string)
  default     = ["/api/*", "/availability*", "/reservar*", "/reservations/*", "/health"]
}

# ── TLS / HTTPS ───────────────────────────────────────────────────────────────

variable "enable_tls" {
  description = "When true, provisions an ACM certificate with DNS validation via Route 53, an HTTPS:443 listener with the certificate, and redirects HTTP:80 to HTTPS. When false, keeps the current HTTP-only behavior for backward compatibility."
  type        = bool
  default     = false
}

variable "domain_name" {
  description = "The primary domain name for the ACM certificate and Route 53 alias record (e.g., app.grupo5.oyd.solid.com.gt). Must be a subdomain of hosted_zone_name."
  type        = string
  default     = ""
}

variable "hosted_zone_name" {
  description = "Route 53 hosted zone domain name (without trailing dot) for DNS validation and the alias record (e.g., grupo5.oyd.solid.com.gt). A data source looks up this zone by name."
  type        = string
  default     = ""
}

variable "app_fqdn" {
  description = "Fully-qualified domain name for the application alias record in Route 53 pointing to the ALB. Typically the same as domain_name."
  type        = string
  default     = ""
}

variable "ssl_policy" {
  description = "SSL/TLS policy for the HTTPS listener. AWS default is ELBSecurityPolicy-2016-08; TLS 1.3 policies are recommended."
  type        = string
  default     = "ELBSecurityPolicy-TLS13-1-2-2021-06"
}

