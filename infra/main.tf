resource "aws_s3_bucket" "this" {
  bucket = "${var.bucket_name_prefix}-${var.environment}"

  tags = {
    Project     = var.project_name
    Environment = var.environment
  }
}
