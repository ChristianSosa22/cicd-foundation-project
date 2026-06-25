# ── Application Load Balancer ─────────────────────────────────────────────────
resource "aws_lb" "this" {
  name               = "${var.name}-${var.environment}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [var.security_group_id]
  subnets            = var.public_subnet_ids

  tags = {
    Environment = var.environment
    Project     = var.name
    Component   = "alb"
    ManagedBy   = "terraform"
  }
}

# ── Target Groups (target_type = ip, required for Fargate awsvpc) ──────────────
resource "aws_lb_target_group" "api" {
  name        = "${var.name}-${var.environment}-api-tg"
  port        = var.api_port
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  # Stateless JSON API with short-lived requests. The default 300s drain makes
  # every rolling deploy hold the old task for 5 minutes, pushing the rollout
  # past the CI `wait services-stable` timeout. 30s is ample for in-flight
  # requests to finish.
  deregistration_delay = 30

  health_check {
    enabled             = true
    path                = var.api_health_check_path
    protocol            = "HTTP"
    matcher             = "200"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  tags = {
    Environment = var.environment
    Service     = "api"
    ManagedBy   = "terraform"
  }
}

resource "aws_lb_target_group" "web" {
  name        = "${var.name}-${var.environment}-web-tg"
  port        = var.web_port
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  # Stateless frontend; same reasoning as the API target group above. Shrink the
  # connection-draining window so deploys converge well within the CI wait.
  deregistration_delay = 30

  health_check {
    enabled  = true
    path     = var.health_check_path
    protocol = "HTTP"
    # Next.js root returns 307 -> /login; accept any < 400 redirect as healthy.
    matcher             = "200-399"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  tags = {
    Environment = var.environment
    Service     = "web"
    ManagedBy   = "terraform"
  }
}

# ── HTTP Listener (port 80) ───────────────────────────────────────────────────
# When enable_tls is false: default action -> web. API paths are matched by a
# higher-priority rule. When enable_tls is true: default action -> 301 redirect
# to HTTPS (all traffic forced to 443).
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.this.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = var.enable_tls ? "redirect" : "forward"

    # Redirect to HTTPS when TLS is enabled
    dynamic "redirect" {
      for_each = var.enable_tls ? [1] : []
      content {
        port        = "443"
        protocol    = "HTTPS"
        status_code = "HTTP_301"
      }
    }

    # Forward to web target group when TLS is disabled
    dynamic "forward" {
      for_each = var.enable_tls ? [] : [1]
      content {
        target_group {
          arn = aws_lb_target_group.web.arn
        }
      }
    }
  }

  tags = {
    Environment = var.environment
    Project     = var.name
    ManagedBy   = "terraform"
  }
}

# API routing rule: send backend paths to the API target group (HTTP listener).
resource "aws_lb_listener_rule" "api" {
  listener_arn = aws_lb_listener.http.arn
  priority     = 100

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }

  condition {
    path_pattern {
      values = var.api_path_patterns
    }
  }

  tags = {
    Environment = var.environment
    Project     = var.name
    ManagedBy   = "terraform"
  }
}

# ── TLS: ACM Certificate ─────────────────────────────────────────────────────
resource "aws_acm_certificate" "this" {
  count = var.enable_tls ? 1 : 0

  domain_name = var.domain_name
  subject_alternative_names = [
    "*.${var.hosted_zone_name}"
  ]
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Environment = var.environment
    Project     = var.name
    ManagedBy   = "terraform"
    Purpose     = "tls"
  }
}

# ── TLS: Route 53 Hosted Zone Lookup ──────────────────────────────────────────
data "aws_route53_zone" "this" {
  count = var.enable_tls ? 1 : 0

  name         = "${var.hosted_zone_name}."
  private_zone = false
}

# ── TLS: DNS Validation Records ──────────────────────────────────────────────
resource "aws_route53_record" "cert_validation" {
  for_each = var.enable_tls ? {
    for dvo in aws_acm_certificate.this[0].domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      type   = dvo.resource_record_type
      record = dvo.resource_record_value
    }
  } : {}

  allow_overwrite = true
  name            = each.value.name
  type            = each.value.type
  records         = [each.value.record]
  ttl             = 60
  zone_id         = data.aws_route53_zone.this[0].zone_id
}

# ── TLS: Certificate Validation Wait ──────────────────────────────────────────
resource "aws_acm_certificate_validation" "this" {
  count = var.enable_tls ? 1 : 0

  certificate_arn         = aws_acm_certificate.this[0].arn
  validation_record_fqdns = [for record in aws_route53_record.cert_validation : record.fqdn]

  timeouts {
    create = "10m"
  }
}

# ── TLS: HTTPS Listener (port 443) ───────────────────────────────────────────
resource "aws_lb_listener" "https" {
  count = var.enable_tls ? 1 : 0

  load_balancer_arn = aws_lb.this.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = var.ssl_policy
  certificate_arn   = aws_acm_certificate_validation.this[0].certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.web.arn
  }

  tags = {
    Environment = var.environment
    Project     = var.name
    ManagedBy   = "terraform"
  }
}

# ── TLS: API Routing Rule on HTTPS ────────────────────────────────────────────
resource "aws_lb_listener_rule" "https_api" {
  count = var.enable_tls ? 1 : 0

  listener_arn = aws_lb_listener.https[0].arn
  priority     = 100

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }

  condition {
    path_pattern {
      values = var.api_path_patterns
    }
  }

  tags = {
    Environment = var.environment
    Project     = var.name
    ManagedBy   = "terraform"
  }
}

# ── TLS: Route 53 Alias Record → ALB ─────────────────────────────────────────
resource "aws_route53_record" "app" {
  count = var.enable_tls ? 1 : 0

  zone_id = data.aws_route53_zone.this[0].zone_id
  name    = var.app_fqdn
  type    = "A"

  alias {
    name                   = aws_lb.this.dns_name
    zone_id                = aws_lb.this.zone_id
    evaluate_target_health = true
  }
}
