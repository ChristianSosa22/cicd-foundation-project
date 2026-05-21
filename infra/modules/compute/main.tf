# ECS Cluster: Agrupa los servicios y tareas de Fargate
resource "aws_ecs_cluster" "this" {
  name = "${var.name}-${var.environment}-cluster"

  tags = {
    Environment = var.environment
  }
}

# IAM Role: Permite que Fargate ejecute tareas y escriba logs en CloudWatch
resource "aws_iam_role" "ecs_task_exec" {
  name = "${var.name}-${var.environment}-ecs-exec-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = { Service = "ecs-tasks.amazonaws.com" }
        Action    = "sts:AssumeRole"
      }
    ]
  })

  tags = {
    Environment = var.environment
  }
}

# IAM Policy: Permisos mínimos para escribir logs en CloudWatch
resource "aws_iam_role_policy" "ecs_logs" {
  name = "${var.name}-${var.environment}-ecs-logs-policy"
  role = aws_iam_role.ecs_task_exec.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:log-group:/ecs/${var.name}-${var.environment}"
      }
    ]
  })
}

# Task Definition: Describe el contenedor: imagen, CPU, memoria y logs
resource "aws_ecs_task_definition" "this" {
  family                   = "${var.name}-${var.environment}"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.cpu
  memory                   = var.memory
  execution_role_arn       = aws_iam_role.ecs_task_exec.arn

  container_definitions = jsonencode([
    {
      name      = "${var.name}-${var.environment}"
      image     = "public.ecr.aws/docker/library/nginx:stable"
      essential = true
      portMappings = [
        {
          containerPort = 80
          protocol      = "tcp"
        }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = "/ecs/${var.name}-${var.environment}"
          "awslogs-region"        = "us-east-1"
          "awslogs-stream-prefix" = "ecs"
          "awslogs-create-group"  = "true"
        }
      }
    }
  ])

  tags = {
    Environment = var.environment
  }
}