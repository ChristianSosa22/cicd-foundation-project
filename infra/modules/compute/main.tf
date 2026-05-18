# IAM Role: Permite que Lambda ejecute y escriba logs en CloudWatch
resource "aws_iam_role" "lambda_exec" {
  name = "${var.name}-${var.environment}-exec-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = { Service = "lambda.amazonaws.com" }
        Action    = "sts:AssumeRole"
      }
    ]
  })

  tags = {
    Environment = var.environment
  }
}

# IAM Policy: Solo permite escribir logs
resource "aws_iam_role_policy" "lambda_logs" {
  name = "${var.name}-${var.environment}-logs-policy"
  role = aws_iam_role.lambda_exec.id

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
        Resource = "arn:aws:logs:*:*:/aws/lambda/${var.name}-${var.environment}"
      }
    ]
  })
}

# Archivo zip mínimo que Lambda necesita para existir
data "archive_file" "dummy" {
  type        = "zip"
  output_path = "${path.module}/lambda_placeholder.zip"

  source {
    content  = "def handler(event, context): return {'statusCode': 200}"
    filename = "handler.py"
  }
}

# Función Lambda
resource "aws_lambda_function" "this" {
  function_name = "${var.name}-${var.environment}"
  role          = aws_iam_role.lambda_exec.arn
  runtime       = "python3.12"
  handler       = "handler.handler"
  filename      = data.archive_file.dummy.output_path
  memory_size   = var.memory_size

  tags = {
    Environment = var.environment
  }
}