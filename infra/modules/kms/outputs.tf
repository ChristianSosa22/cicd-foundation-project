output "key_arn" {
  description = "ARN of the KMS CMK."
  value       = aws_kms_key.main.arn
}

output "key_id" {
  description = "Key ID of the KMS CMK."
  value       = aws_kms_key.main.key_id
}

output "alias_arn" {
  description = "ARN of the KMS alias."
  value       = aws_kms_alias.main.arn
}

output "alias_name" {
  description = "Full alias name (including the 'alias/' prefix)."
  value       = aws_kms_alias.main.name
}
