# IaC Coverage — Full Component-to-Terraform Mapping

Todo recurso cloud utilizado por la aplicación está provisionado y administrado
por Terraform. La tabla a continuación mapea cada componente en ejecución al
servicio cloud, tipo de recurso Terraform y el módulo que lo gestiona. Ningún
recurso existe fuera del Terraform state.

## No Manual Resources — Team Confirmation

**Confirmamos que ningún recurso cloud utilizado por esta aplicación fue creado
manualmente a través de la consola de AWS, CLI, o cualquier mecanismo fuera de
Terraform.**

Todos los recursos han sido provisionados exclusivamente vía `terraform apply`
desde la primera entrega. El pipeline de CI/CD (GitHub Actions) es el único
camino que ejecuta `terraform apply` contra el ambiente en producción — ningún
miembro del equipo ha realizado acciones manuales en la consola de AWS para
crear infraestructura.

### terraform import history

No se han ejecutado comandos `terraform import` en ningún momento de este
proyecto. Verificación:

- `git log --all --grep="import"` no retorna resultados
- No existen bloques `import {}` en ningún archivo `.tf`
- No aparecen llamadas a `terraform import` en ningún script, workflow o runbook

Cada recurso visible en la consola de AWS está contabilizado en
`infra/evidence/state-list.txt` y mapea directamente a una fila en la tabla
de mapeo de componentes a continuación.

---

## Component-to-IaC Mapping

### Networking

| Application Component | Cloud Service Used | Terraform Resource Type | Module Path |
|---|---|---|---|
| Custom VPC | Amazon VPC | `aws_vpc` | `infra/modules/network` |
| Public subnets (×2 AZ) | Amazon VPC | `aws_subnet` | `infra/modules/network` |
| Private application subnets (×2 AZ) | Amazon VPC | `aws_subnet` | `infra/modules/network` |
| Private data subnets (×2 AZ) | Amazon VPC | `aws_subnet` | `infra/modules/network` |
| Internet Gateway | Amazon VPC | `aws_internet_gateway` | `infra/modules/network` |
| NAT Gateway (conditional) | Amazon VPC | `aws_nat_gateway` | `infra/modules/network` |
| Elastic IP for NAT Gateway | Amazon EC2 | `aws_eip` | `infra/modules/network` |
| Public route table | Amazon VPC | `aws_route_table` | `infra/modules/network` |
| Private application route table | Amazon VPC | `aws_route_table` | `infra/modules/network` |
| Private data route table (isolated) | Amazon VPC | `aws_route_table` | `infra/modules/network` |
| Route table associations | Amazon VPC | `aws_route_table_association` | `infra/modules/network` |
| Default route → Internet Gateway | Amazon VPC | `aws_route` | `infra/modules/network` |
| Default route → NAT Gateway | Amazon VPC | `aws_route` | `infra/modules/network` |
| Public subnet NACL | Amazon VPC | `aws_network_acl` | `infra/modules/network` |
| Private subnet NACL | Amazon VPC | `aws_network_acl` | `infra/modules/network` |
| NACL associations | Amazon VPC | `aws_network_acl_association` | `infra/modules/network` |
| NACL inbound / outbound rules | Amazon VPC | `aws_network_acl_rule` | `infra/modules/network` |

### Security Groups

| Application Component | Cloud Service Used | Terraform Resource Type | Module Path |
|---|---|---|---|
| ALB / public-facing security group | Amazon VPC | `aws_security_group` | `infra/modules/security` |
| API (application) security group | Amazon VPC | `aws_security_group` | `infra/modules/security` |
| Web service security group | Amazon VPC | `aws_security_group` | `infra/modules/security` |
| Database security group | Amazon VPC | `aws_security_group` | `infra/modules/security` |
| Security group rules (ingress / egress) | Amazon VPC | `aws_security_group_rule` | `infra/modules/security` |

### Load Balancer

| Application Component | Cloud Service Used | Terraform Resource Type | Module Path |
|---|---|---|---|
| Application Load Balancer | AWS ALB | `aws_lb` | `infra/modules/alb` |
| HTTP:80 listener (redirect to HTTPS) | AWS ALB | `aws_lb_listener` | `infra/modules/alb` |
| HTTPS:443 listener | AWS ALB | `aws_lb_listener` | `infra/modules/alb` |
| API target group (port 8080) | AWS ALB | `aws_lb_target_group` | `infra/modules/alb` |
| Web target group (port 3000) | AWS ALB | `aws_lb_target_group` | `infra/modules/alb` |
| ALB listener rule — API paths | AWS ALB | `aws_lb_listener_rule` | `infra/modules/alb` |
| ACM TLS certificate | AWS ACM | `aws_acm_certificate` | `infra/modules/alb` |
| ACM certificate DNS validation | AWS ACM | `aws_acm_certificate_validation` | `infra/modules/alb` |
| Route 53 DNS alias record (app FQDN) | Amazon Route 53 | `aws_route53_record` | `infra/modules/alb` |
| Route 53 DNS validation record | Amazon Route 53 | `aws_route53_record` | `infra/modules/alb` |

### Compute — API Service

| Application Component | Cloud Service Used | Terraform Resource Type | Module Path |
|---|---|---|---|
| ECS cluster | Amazon ECS | `aws_ecs_cluster` | `infra/modules/compute` |
| API task definition | Amazon ECS (Fargate) | `aws_ecs_task_definition` | `infra/modules/compute` |
| API ECS service | Amazon ECS (Fargate) | `aws_ecs_service` | `infra/modules/compute` |
| API CloudWatch log group | Amazon CloudWatch Logs | `aws_cloudwatch_log_group` | `infra/modules/compute` |

### Compute — Web Frontend Service

| Application Component | Cloud Service Used | Terraform Resource Type | Module Path |
|---|---|---|---|
| Web task definition | Amazon ECS (Fargate) | `aws_ecs_task_definition` | `infra/modules/compute` |
| Web ECS service | Amazon ECS (Fargate) | `aws_ecs_service` | `infra/modules/compute` |
| Web CloudWatch log group | Amazon CloudWatch Logs | `aws_cloudwatch_log_group` | `infra/modules/compute` |

### Compute — Async Worker Service

| Application Component | Cloud Service Used | Terraform Resource Type | Module Path |
|---|---|---|---|
| Async worker task definition | Amazon ECS (Fargate) | `aws_ecs_task_definition` | `infra/modules/compute` |
| Async worker ECS service | Amazon ECS (Fargate) | `aws_ecs_service` | `infra/modules/compute` |
| Worker CloudWatch log group | Amazon CloudWatch Logs | `aws_cloudwatch_log_group` | `infra/modules/compute` |

### Container Registry

| Application Component | Cloud Service Used | Terraform Resource Type | Module Path |
|---|---|---|---|
| API ECR repository | Amazon ECR | `aws_ecr_repository` | `infra/modules/ecr` |
| Web ECR repository | Amazon ECR | `aws_ecr_repository` | `infra/modules/ecr` |
| API ECR lifecycle policy | Amazon ECR | `aws_ecr_lifecycle_policy` | `infra/modules/ecr` |
| Web ECR lifecycle policy | Amazon ECR | `aws_ecr_lifecycle_policy` | `infra/modules/ecr` |

### Database

| Application Component | Cloud Service Used | Terraform Resource Type | Module Path |
|---|---|---|---|
| PostgreSQL RDS instance | Amazon RDS | `aws_db_instance` | `infra/modules/database` |
| RDS DB subnet group | Amazon RDS | `aws_db_subnet_group` | `infra/modules/database` |
| RDS DB parameter group | Amazon RDS | `aws_db_parameter_group` | `infra/modules/database` |

### Storage

| Application Component | Cloud Service Used | Terraform Resource Type | Module Path |
|---|---|---|---|
| Receipts S3 bucket | Amazon S3 | `aws_s3_bucket` | `infra/modules/storage` |
| S3 versioning configuration | Amazon S3 | `aws_s3_bucket_versioning` | `infra/modules/storage` |
| S3 SSE-KMS encryption configuration | Amazon S3 | `aws_s3_bucket_server_side_encryption_configuration` | `infra/modules/storage` |
| S3 lifecycle configuration | Amazon S3 | `aws_s3_bucket_lifecycle_configuration` | `infra/modules/storage` |
| S3 public access block | Amazon S3 | `aws_s3_bucket_public_access_block` | `infra/modules/storage` |
| S3 bucket policy (deny non-HTTPS) | Amazon S3 | `aws_s3_bucket_policy` | `infra/modules/storage` |

### Async Messaging (×3 flows: receipt, release, email)

| Application Component | Cloud Service Used | Terraform Resource Type | Module Path |
|---|---|---|---|
| Receipt SQS queue | Amazon SQS | `aws_sqs_queue` | `infra/modules/async` |
| Receipt DLQ | Amazon SQS | `aws_sqs_queue` | `infra/modules/async` |
| Release SQS queue | Amazon SQS | `aws_sqs_queue` | `infra/modules/async` |
| Release DLQ | Amazon SQS | `aws_sqs_queue` | `infra/modules/async` |
| Email SQS queue | Amazon SQS | `aws_sqs_queue` | `infra/modules/async` |
| Email DLQ | Amazon SQS | `aws_sqs_queue` | `infra/modules/async` |

### Scheduler

| Application Component | Cloud Service Used | Terraform Resource Type | Module Path |
|---|---|---|---|
| Expired-reservation sweep schedule | Amazon EventBridge Scheduler | `aws_scheduler_schedule` | `infra/modules/scheduler` |

### Encryption (KMS)

| Application Component | Cloud Service Used | Terraform Resource Type | Module Path |
|---|---|---|---|
| Customer-managed KMS key (CMK) | AWS KMS | `aws_kms_key` | `infra/modules/kms` |
| KMS key alias | AWS KMS | `aws_kms_alias` | `infra/modules/kms` |

### Secrets & Parameters

| Application Component | Cloud Service Used | Terraform Resource Type | Module Path |
|---|---|---|---|
| DB password secret | AWS Secrets Manager | `aws_secretsmanager_secret` | `infra/modules/secrets` |
| DB password secret version | AWS Secrets Manager | `aws_secretsmanager_secret_version` | `infra/modules/secrets` |
| DATABASE_URL SSM parameter | AWS SSM Parameter Store | `aws_ssm_parameter` | `infra/modules/secrets` |
| JWT_SECRET SSM parameter | AWS SSM Parameter Store | `aws_ssm_parameter` | `infra/modules/secrets` |
| ENCRYPTION_KEY SSM parameter | AWS SSM Parameter Store | `aws_ssm_parameter` | `infra/modules/secrets` |
| HMAC_KEY SSM parameter | AWS SSM Parameter Store | `aws_ssm_parameter` | `infra/modules/secrets` |

### IAM Roles

| Application Component | Cloud Service Used | Terraform Resource Type | Module Path |
|---|---|---|---|
| ECS task execution role | AWS IAM | `aws_iam_role` | `infra/modules/iam` |
| ECS task execution role — SSM/Secrets policy | AWS IAM | `aws_iam_role_policy` | `infra/modules/iam` |
| ECS task execution role — managed policy attachment | AWS IAM | `aws_iam_role_policy_attachment` | `infra/modules/iam` |
| API task role | AWS IAM | `aws_iam_role` | `infra/modules/iam` |
| API task role — S3 policy | AWS IAM | `aws_iam_role_policy` | `infra/modules/iam` |
| API task role — SQS policy | AWS IAM | `aws_iam_role_policy` | `infra/modules/iam` |
| API task role — RDS connect policy | AWS IAM | `aws_iam_role_policy` | `infra/modules/iam` |
| API task role — KMS policy | AWS IAM | `aws_iam_role_policy` | `infra/modules/iam` |
| API task role — Secrets Manager policy | AWS IAM | `aws_iam_role_policy` | `infra/modules/iam` |
| API task role — ECS Exec policy | AWS IAM | `aws_iam_role_policy` | `infra/modules/iam` |
| Receipt worker role | AWS IAM | `aws_iam_role` | `infra/modules/iam` |
| Receipt worker role — SQS policy | AWS IAM | `aws_iam_role_policy` | `infra/modules/iam` |
| Receipt worker role — S3 policy | AWS IAM | `aws_iam_role_policy` | `infra/modules/iam` |
| Receipt worker role — SNS policy | AWS IAM | `aws_iam_role_policy` | `infra/modules/iam` |
| Receipt worker role — Secrets Manager policy | AWS IAM | `aws_iam_role_policy` | `infra/modules/iam` |
| Receipt worker role — CloudWatch Logs policy | AWS IAM | `aws_iam_role_policy` | `infra/modules/iam` |
| Release worker role | AWS IAM | `aws_iam_role` | `infra/modules/iam` |
| Release worker role — SQS policy | AWS IAM | `aws_iam_role_policy` | `infra/modules/iam` |
| Release worker role — Secrets Manager policy | AWS IAM | `aws_iam_role_policy` | `infra/modules/iam` |
| Release worker role — CloudWatch Logs policy | AWS IAM | `aws_iam_role_policy` | `infra/modules/iam` |
| Email worker role | AWS IAM | `aws_iam_role` | `infra/modules/iam` |
| Email worker role — SQS policy | AWS IAM | `aws_iam_role_policy` | `infra/modules/iam` |
| Email worker role — Secrets Manager policy | AWS IAM | `aws_iam_role_policy` | `infra/modules/iam` |
| Email worker role — CloudWatch Logs policy | AWS IAM | `aws_iam_role_policy` | `infra/modules/iam` |
| EventBridge Scheduler role | AWS IAM | `aws_iam_role` | `infra/modules/iam` |
| EventBridge Scheduler role — SQS policy | AWS IAM | `aws_iam_role_policy` | `infra/modules/iam` |
| GitHub Actions CI runner role (OIDC) | AWS IAM | `aws_iam_role` | `infra/modules/iam` |
| CI runner role — Terraform permissions policy | AWS IAM | `aws_iam_role_policy` | `infra/modules/iam` |
| Async worker task role | AWS IAM | `aws_iam_role` | `infra/modules/compute` |
| Async worker task role — SQS policy | AWS IAM | `aws_iam_role_policy` | `infra/modules/compute` |
| Async worker task role — S3 policy | AWS IAM | `aws_iam_role_policy` | `infra/modules/compute` |

### Observability

| Application Component | Cloud Service Used | Terraform Resource Type | Module Path |
|---|---|---|---|
| API 5xx error alarm | Amazon CloudWatch | `aws_cloudwatch_metric_alarm` | `infra/modules/observability` |
| Release DLQ depth alarm | Amazon CloudWatch | `aws_cloudwatch_metric_alarm` | `infra/modules/observability` |
| CloudWatch operational dashboard | Amazon CloudWatch | `aws_cloudwatch_dashboard` | `infra/modules/observability` |
| Observability CloudWatch log group | Amazon CloudWatch Logs | `aws_cloudwatch_log_group` | `infra/modules/observability` |
| Alerts SNS topic | Amazon SNS | `aws_sns_topic` | `infra/modules/observability` |
| Alerts SNS email subscription | Amazon SNS | `aws_sns_topic_subscription` | `infra/modules/observability` |
| Monthly cost budget | AWS Budgets | `aws_budgets_budget` | `infra/modules/observability` |
