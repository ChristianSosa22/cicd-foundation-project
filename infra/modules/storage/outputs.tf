output "bucket_arn" {
  description = "ARN of the S3 bucket. Used to reference the bucket in IAM policies."
  value       = aws_s3_bucket.this.arn
}

output "bucket_name" {
  description = "Name of the bucket in AWS."
  value       = aws_s3_bucket.this.bucket
}