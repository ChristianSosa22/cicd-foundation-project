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
}

module "compute" {
  source = "./modules/compute"

  environment                   = var.environment
  name                          = var.project_name
  region                        = var.region
  private_subnet_ids            = module.network.private_app_subnet_ids
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

  # IAM: scope the API task role to the receipts bucket
  receipts_bucket_arn = module.storage.bucket_arn

  # ALB integration: register API/web task IPs in the ALB target groups.
  api_target_group_arn = module.alb.api_target_group_arn
  web_target_group_arn = module.alb.web_target_group_arn

  depends_on = [module.network, module.security, module.ecr, module.secrets, module.alb]
}

module "alb" {
  source = "./modules/alb"

  name              = var.project_name
  environment       = var.environment
  vpc_id            = module.network.vpc_id
  public_subnet_ids = module.network.public_subnet_ids
  security_group_id = module.security.web_security_group_id
  health_check_path = var.health_check_path

  depends_on = [module.network, module.security]
}
