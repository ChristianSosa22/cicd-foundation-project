# ── Async worker (SQS consumer) — Delivery 4, VPC track ───────────────────────
# Runs as its own ECS Fargate service, separate from the API. Reuses the API
# container image but overrides the command to run the worker entrypoint
# (node dist/worker.js). Polls the receipt SQS queue and writes objects to S3.

# CloudWatch log group for the worker.
resource "aws_cloudwatch_log_group" "worker" {
  name              = "/ecs/${var.name}-${var.environment}/worker"
  retention_in_days = 30

  tags = {
    Environment = var.environment
    Service     = "worker"
    ManagedBy   = "terraform"
  }
}

# ── IAM: dedicated worker task role (least privilege) ─────────────────────────
# Assumed BY the running worker container. Scoped to ONLY what the consumer needs:
# receive/delete on the specific queue, and PutObject on the specific bucket.
resource "aws_iam_role" "worker_task" {
  name = "${var.name}-${var.environment}-worker-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = {
    Environment = var.environment
    Project     = var.name
    ManagedBy   = "terraform"
  }
}

# SQS consume permissions, scoped to the specific queue ARN — no wildcard.
resource "aws_iam_role_policy" "worker_sqs" {
  name = "${var.name}-${var.environment}-worker-sqs"
  role = aws_iam_role.worker_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "sqs:ReceiveMessage",
        "sqs:DeleteMessage",
        "sqs:GetQueueAttributes"
      ]
      Resource = var.sqs_queue_arn
    }]
  })
}

# S3 write permission, scoped to objects in the receipts bucket — no wildcard on the account.
resource "aws_iam_role_policy" "worker_s3" {
  name = "${var.name}-${var.environment}-worker-s3"
  role = aws_iam_role.worker_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["s3:PutObject"]
      Resource = "${var.receipts_bucket_arn}/*"
    }]
  })
}

# ── Worker task definition ────────────────────────────────────────────────────
# Same image as the API, but command overridden to the worker entrypoint.
resource "aws_ecs_task_definition" "worker" {
  family                   = "${var.name}-${var.environment}-worker"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.worker_cpu
  memory                   = var.worker_memory
  execution_role_arn       = var.compute_exec_role_arn
  task_role_arn            = aws_iam_role.worker_task.arn

  container_definitions = jsonencode([{
    name      = "worker"
    image     = var.api_image
    essential = true
    command   = ["node", "dist/worker.js"]

    # Non-secret config injected as plaintext environment variables.
    # RECEIPT_QUEUE_URL and POLLING_BATCH_SIZE come from Terraform vars (no hardcoded values).
    environment = [
      { name = "NODE_ENV", value = "production" },
      { name = "AWS_REGION", value = var.aws_region },
      { name = "S3_BUCKET", value = var.s3_bucket },
      { name = "RECEIPT_QUEUE_URL", value = var.sqs_queue_url },
      { name = "POLLING_BATCH_SIZE", value = tostring(var.polling_batch_size) }
    ]

    # The worker loads config/env.ts, which requires DATABASE_URL and JWT_SECRET,
    # so we inject the same SSM secrets the API uses.
    secrets = [
      { name = "DATABASE_URL", valueFrom = var.secret_arns["DATABASE_URL"] },
      { name = "JWT_SECRET", valueFrom = var.secret_arns["JWT_SECRET"] },
      { name = "ENCRYPTION_KEY", valueFrom = var.secret_arns["ENCRYPTION_KEY"] },
      { name = "HMAC_KEY", valueFrom = var.secret_arns["HMAC_KEY"] }
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.worker.name
        "awslogs-region"        = var.region
        "awslogs-stream-prefix" = "ecs"
      }
    }
  }])

  tags = {
    Environment = var.environment
    Service     = "worker"
    ManagedBy   = "terraform"
  }
}

# ── Worker ECS service ────────────────────────────────────────────────────────
# No load balancer: the worker is a polling consumer with no inbound HTTP.
resource "aws_ecs_service" "worker" {
  name            = "${var.name}-${var.environment}-worker-svc"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.worker.arn
  desired_count   = var.worker_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [var.worker_security_group_id]
    assign_public_ip = false
  }

  # Ignore task_definition so CI can deploy new images without Terraform rollback;
  # ignore desired_count for manual scaling (e.g., 0 to pause polling).
  lifecycle {
    ignore_changes = [task_definition, desired_count]
  }

  tags = {
    Environment = var.environment
    Service     = "worker"
    ManagedBy   = "terraform"
  }
}
