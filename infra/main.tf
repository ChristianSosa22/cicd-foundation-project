# Module call order: network → security → ecr → storage → database → secrets → → async → scheduler → compute.
# Security provides the chained SGs (web/ALB, app, web-service, db). The ALB reuses the
# web (public-facing) SG from the security module and registers task IPs in its target groups.
# Compute depends on ECR URLs, SSM ARNs, private subnet IDs, SG IDs, the receipts bucket, and the ALB.

module "network" {
  source = "./modules/network"

  name                      = var.project_name
  environment               = var.environment
  vpc_cidr                  = var.vpc_cidr
  az_count                  = var.az_count
  public_subnet_cidrs       = var.public_subnet_cidrs
  private_app_subnet_cidrs  = var.private_app_subnet_cidrs
  private_data_subnet_cidrs = var.private_data_subnet_cidrs
  single_nat_gateway        = var.single_nat_gateway
  enable_nat_gateway        = var.enable_nat_gateway
}

module "security" {
  source = "./modules/security"

  name        = var.project_name
  environment = var.environment
  vpc_id      = module.network.vpc_id
  app_port    = var.app_port
  web_port    = var.web_port
  db_port     = var.db_port

  depends_on = [module.network]
}

module "ecr" {
  source = "./modules/ecr"

  name        = var.project_name
  environment = var.environment
}

module "storage" {
  source = "./modules/storage"

  name        = var.project_name
  environment = var.environment
}

module "database" {
  source = "./modules/database"

  environment          = var.environment
  project_name         = var.project_name
  db_name              = var.db_name
  db_username          = var.db_username
  db_password          = var.db_password
  db_port              = var.db_port
  db_instance_class    = var.db_instance_class
  db_allocated_storage = var.db_allocated_storage
  db_engine_version    = var.db_engine_version
  multi_az             = var.multi_az
  skip_final_snapshot  = var.skip_final_snapshot
  deletion_protection  = var.deletion_protection
  subnet_ids           = module.network.private_data_subnet_ids
  db_security_group_id = module.security.db_security_group_id

  depends_on = [module.network, module.security]
}

module "secrets" {
  source = "./modules/secrets"

  name        = var.project_name
  environment = var.environment
}

module "async_receipt" {
  source = "./modules/async"

  name                          = var.project_name
  environment                   = var.environment
  queue_name_prefix             = "${var.project_name}-${var.environment}-receipt"
  visibility_timeout_seconds    = var.receipt_visibility_timeout_seconds
  message_retention_seconds     = var.receipt_message_retention_seconds
  max_receive_count             = var.max_receive_count
  dlq_message_retention_seconds = var.dlq_message_retention_seconds
}

module "async_release" {
  source = "./modules/async"

  name                          = var.project_name
  environment                   = var.environment
  queue_name_prefix             = "${var.project_name}-${var.environment}-release"
  visibility_timeout_seconds    = var.release_visibility_timeout_seconds
  message_retention_seconds     = var.release_message_retention_seconds
  max_receive_count             = var.max_receive_count
  dlq_message_retention_seconds = var.dlq_message_retention_seconds
}

module "async_email" {
  source = "./modules/async"

  name                          = var.project_name
  environment                   = var.environment
  queue_name_prefix             = "${var.project_name}-${var.environment}-receipt-email"
  visibility_timeout_seconds    = var.email_visibility_timeout_seconds
  message_retention_seconds     = var.email_message_retention_seconds
  max_receive_count             = var.max_receive_count
  dlq_message_retention_seconds = var.dlq_message_retention_seconds
}

module "scheduler" {
  source = "./modules/scheduler"

  name                = var.project_name
  environment         = var.environment
  schedule_expression = var.schedule_expression
  scheduler_timezone  = var.scheduler_timezone
  target_queue_arn    = module.async_release.queue_arn
  target_message      = var.scheduler_target_message
  scheduler_role_arn  = module.iam.scheduler_role_arn
}

module "compute" {
  source = "./modules/compute"

  environment                   = var.environment
  name                          = var.project_name
  region                        = var.region
  subnet_ids                    = module.network.public_subnet_ids
  assign_public_ip              = true
  api_security_group_id         = module.security.app_security_group_id
  web_service_security_group_id = module.security.web_service_security_group_id

  # Image URIs: ECR repo URL + configurable tag
  api_image = "${module.ecr.api_repository_url}:${var.api_image_tag}"
  web_image = "${module.ecr.web_repository_url}:${var.web_image_tag}"

  # Fargate sizing
  api_cpu    = var.api_cpu
  api_memory = var.api_memory
  web_cpu    = var.web_cpu
  web_memory = var.web_memory

  # Non-secret runtime config
  aws_region = var.region
  s3_bucket  = module.storage.bucket_name

  # Secret ARNs from SSM — Fargate pulls values at container start
  secret_arns = module.secrets.parameter_arns

  # IAM roles from the centralized IAM module
  compute_exec_role_arn = module.iam.compute_exec_role_arn
  compute_task_role_arn = module.iam.compute_task_role_arn

  # IAM: scope the API task role to the receipts bucket
  receipts_bucket_arn = module.storage.bucket_arn

  # ALB integration: register API/web task IPs in the ALB target groups.
  api_target_group_arn = module.alb.api_target_group_arn
  web_target_group_arn = module.alb.web_target_group_arn


  # Async worker (SQS consumer) — Delivery 4. Wired from the async_receipt queue
  # and the app security group (same network profile as the API).
  worker_security_group_id = module.security.app_security_group_id
  sqs_queue_url            = module.async_receipt.queue_url
  sqs_queue_arn            = module.async_receipt.queue_arn
  worker_desired_count     = var.worker_desired_count
  polling_batch_size       = var.polling_batch_size
  depends_on               = [module.network, module.security, module.ecr, module.secrets, module.alb]
}

module "iam" {
  source = "./modules/iam"

  project_name        = var.project_name
  environment         = var.environment
  region              = var.region
  receipts_bucket_arn = module.storage.bucket_arn
  rds_instance_arn    = module.database.db_instance_arn
  db_username         = var.db_username
  receipt_queue_arn   = module.async_receipt.queue_arn
  release_queue_arn   = module.async_release.queue_arn
  email_queue_arn     = module.async_email.queue_arn
  sns_topic_arn       = ""
  kms_key_arn         = ""
  github_repo         = var.github_repo
  oidc_provider_arn   = ""
}

module "observability" {
  source = "./modules/observability"

  name        = var.project_name
  environment = var.environment
  region      = var.region

  # Notifications
  alert_email = var.alert_email

  # Log retention
  log_retention_days = var.observability_log_retention_days

  # Budget
  monthly_budget_limit = var.monthly_budget_limit

  # ALB alarm dimensions — arn_suffix outputs added to the alb module
  alb_arn_suffix              = module.alb.alb_arn_suffix
  api_target_group_arn_suffix = module.alb.api_target_group_arn_suffix

  # Release DLQ alarm dimension — dlq_name output added to the async module
  release_dlq_name = module.async_release.dlq_name

  depends_on = [module.alb, module.async_release]
}

module "alb" {
  source = "./modules/alb"

  name              = var.project_name
  environment       = var.environment
  vpc_id            = module.network.vpc_id
  public_subnet_ids = module.network.public_subnet_ids
  security_group_id = module.security.web_security_group_id
  health_check_path = var.health_check_path

  # TLS / HTTPS
  enable_tls       = var.enable_tls
  domain_name      = var.domain_name
  hosted_zone_name = var.hosted_zone_name
  app_fqdn         = var.app_fqdn
  ssl_policy       = var.ssl_policy

  depends_on = [module.network, module.security]
}
