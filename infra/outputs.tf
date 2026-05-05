output "bucket_name" {
  description = "Name of the S3 bucket provisioned by this workspace. Use this for s3:// URIs and most CLI/API operations."
  value       = aws_s3_bucket.this.bucket
}

output "bucket_arn" {
  description = "ARN of the S3 bucket. Use this when granting access to the bucket from IAM policies."
  value       = aws_s3_bucket.this.arn
}
