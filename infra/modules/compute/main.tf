# ── ECS Cluster ───────────────────────────────────────────────────────────────
resource "aws_ecs_cluster" "this" {
  name = "${var.name}-${var.environment}-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = {
    Environment = var.environment
    Project     = var.name
    ManagedBy   = "terraform"
  }
}

# ── CloudWatch Log Groups ─────────────────────────────────────────────────────
resource "aws_cloudwatch_log_group" "api" {
  name              = "/ecs/${var.name}-${var.environment}/api"
  retention_in_days = 30

  tags = {
    Environment = var.environment
    Service     = "api"
    ManagedBy   = "terraform"
  }
}

resource "aws_cloudwatch_log_group" "web" {
  name              = "/ecs/${var.name}-${var.environment}/web"
  retention_in_days = 30

  tags = {
    Environment = var.environment
    Service     = "web"
    ManagedBy   = "terraform"
  }
}

# ── Task Definitions ──────────────────────────────────────────────────────────

# API: Node/Express backend. Health check uses /ready (DB-aware) per health.routes.ts.
resource "aws_ecs_task_definition" "api" {
  family                   = "${var.name}-${var.environment}-api"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.api_cpu
  memory                   = var.api_memory
  execution_role_arn       = var.compute_exec_role_arn
  task_role_arn            = var.compute_task_role_arn

  container_definitions = jsonencode([{
    name      = "api"
    image     = var.api_image
    essential = true

    portMappings = [{
      containerPort = 8080
      protocol      = "tcp"
    }]

    # Non-secret config injected as plaintext environment variables.
    # RECEIPT_QUEUE_URL wires the async producer endpoint (POST /reservas/enqueue)
    # to the SQS receipt queue provisioned by the async module.
    environment = [
      { name = "NODE_ENV", value = "production" },
      { name = "PORT", value = "8080" },
      { name = "AWS_REGION", value = var.aws_region },
      { name = "S3_BUCKET", value = var.s3_bucket },
      { name = "RECEIPT_QUEUE_URL", value = var.sqs_queue_url }
    ]

    # Secret config pulled from SSM at container start — never stored in plaintext
    secrets = [
      { name = "DATABASE_URL", valueFrom = var.secret_arns["DATABASE_URL"] },
      { name = "JWT_SECRET", valueFrom = var.secret_arns["JWT_SECRET"] },
      { name = "ENCRYPTION_KEY", valueFrom = var.secret_arns["ENCRYPTION_KEY"] },
      { name = "HMAC_KEY", valueFrom = var.secret_arns["HMAC_KEY"] }
    ]

    # /ready performs a SELECT 1 against Postgres — use this for ALB health checks
    healthCheck = {
      command     = ["CMD-SHELL", "node -e \"require('http').get('http://localhost:8080/ready',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))\""]
      interval    = 30
      timeout     = 5
      retries     = 3
      startPeriod = 60
    }

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.api.name
        "awslogs-region"        = var.region
        "awslogs-stream-prefix" = "ecs"
      }
    }
  }])

  tags = {
    Environment = var.environment
    Service     = "api"
    ManagedBy   = "terraform"
  }
}

# Web: Next.js standalone server. Health check uses / (302→/login is acceptable).
# IMPORTANT: NEXT_PUBLIC_API_URL is a build-time variable baked into the JS bundle.
# Setting it as a runtime env var here has no effect for client-side Next.js code.
# The correct value must be passed as --build-arg NEXT_PUBLIC_API_URL=<url> during
# docker build. See infra/README.md for the full image build workflow.
resource "aws_ecs_task_definition" "web" {
  family                   = "${var.name}-${var.environment}-web"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.web_cpu
  memory                   = var.web_memory
  execution_role_arn       = var.compute_exec_role_arn

  container_definitions = jsonencode([{
    name      = "web"
    image     = var.web_image
    essential = true

    portMappings = [{
      containerPort = 3000
      protocol      = "tcp"
    }]

    environment = [
      { name = "NODE_ENV", value = "production" },
      { name = "PORT", value = "3000" },
      { name = "HOSTNAME", value = "0.0.0.0" }
    ]

    # Root path (/) returns 307 → /login, which is < 500, so the check passes
    healthCheck = {
      command     = ["CMD-SHELL", "node -e \"require('http').get('http://localhost:3000/',r=>process.exit(r.statusCode<500?0:1)).on('error',()=>process.exit(1))\""]
      interval    = 30
      timeout     = 5
      retries     = 3
      startPeriod = 60
    }

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.web.name
        "awslogs-region"        = var.region
        "awslogs-stream-prefix" = "ecs"
      }
    }
  }])

  tags = {
    Environment = var.environment
    Service     = "web"
    ManagedBy   = "terraform"
  }
}

# ── ECS Services ──────────────────────────────────────────────────────────────
resource "aws_ecs_service" "api" {
  name                   = "${var.name}-${var.environment}-api-svc"
  cluster                = aws_ecs_cluster.this.id
  task_definition        = aws_ecs_task_definition.api.arn
  desired_count          = var.api_desired_count
  launch_type            = "FARGATE"
  enable_execute_command = true

  # Give tasks time to boot and pass the ALB health check before ECS judges them.
  health_check_grace_period_seconds = 90

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [var.api_security_group_id]
    assign_public_ip = false
  }

  # Register task IPs in the API target group; ALB routes /api, /availability,
  # /reservar, /health, /ready to these tasks on port 8080.
  load_balancer {
    target_group_arn = var.api_target_group_arn
    container_name   = "api"
    container_port   = 8080
  }

  # Ignore task_definition so CI can deploy new images via 'aws ecs update-service'
  # without Terraform rolling back. Ignore desired_count for future autoscaling.
  lifecycle {
    ignore_changes = [task_definition, desired_count]
  }

  tags = {
    Environment = var.environment
    Service     = "api"
    ManagedBy   = "terraform"
  }
}

resource "aws_ecs_service" "web" {
  name            = "${var.name}-${var.environment}-web-svc"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.web.arn
  desired_count   = var.web_desired_count
  launch_type     = "FARGATE"

  health_check_grace_period_seconds = 90

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [var.web_service_security_group_id]
    assign_public_ip = false
  }

  # Register task IPs in the web target group; ALB default action (all paths
  # not matched by the API rule) forwards here on port 3000.
  load_balancer {
    target_group_arn = var.web_target_group_arn
    container_name   = "web"
    container_port   = 3000
  }

  lifecycle {
    ignore_changes = [task_definition, desired_count]
  }

  tags = {
    Environment = var.environment
    Service     = "web"
    ManagedBy   = "terraform"
  }
}
