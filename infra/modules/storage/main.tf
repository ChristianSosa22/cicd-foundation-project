# S3 receipts bucket — stores reservation receipt PDFs and QR codes.
# The API uploads files under the 'receipts/' prefix and generates presigned GET/PUT URLs.
resource "aws_s3_bucket" "this" {
  bucket = "${var.name}-receipts-${var.environment}"

  tags = {
    Environment = var.environment
    Project     = var.name
    ManagedBy   = "terraform"
  }
}

# Versioning: retain previous versions of each receipt object
resource "aws_s3_bucket_versioning" "this" {
  bucket = aws_s3_bucket.this.id

  versioning_configuration {
    status = "Enabled"
  }
}

# Encryption: all objects stored with AES256 server-side encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "this" {
  bucket = aws_s3_bucket.this.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Lifecycle rule: transition old receipts to cheaper storage after 30 days;
# expire noncurrent versions after 90 days to control costs.
resource "aws_s3_bucket_lifecycle_configuration" "this" {
  bucket = aws_s3_bucket.this.id

  rule {
    id     = "transition-old-receipts"
    status = "Enabled"

    filter {
      prefix = "receipts/"
    }

    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }

    noncurrent_version_expiration {
      noncurrent_days = 90
    }
  }
}

# Block all public access — receipts are served via presigned URLs only
resource "aws_s3_bucket_public_access_block" "this" {
  bucket = aws_s3_bucket.this.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Bucket policy: deny all non-HTTPS requests (in transit encryption)
resource "aws_s3_bucket_policy" "this" {
  bucket = aws_s3_bucket.this.id

  depends_on = [aws_s3_bucket_public_access_block.this]

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "DenyNonSSL"
      Effect    = "Deny"
      Principal = "*"
      Action    = "s3:*"
      Resource = [
        aws_s3_bucket.this.arn,
        "${aws_s3_bucket.this.arn}/*"
      ]
      Condition = {
        Bool = { "aws:SecureTransport" = "false" }
      }
    }]
  })
}
