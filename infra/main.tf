# Module call order: network → ecr → storage → database → secrets → compute.
# Secrets depend on the DB endpoint (for DATABASE_URL documentation).
# Compute depends on ECR URLs, SSM ARNs, private subnet IDs, and the receipts bucket.

module "network" {
  source = "./modules/network"

  name                 = var.project_name
  environment          = var.environment
  vpc_cidr             = var.vpc_cidr
  az_count             = var.az_count
  public_subnet_cidrs  = var.public_subnet_cidrs
  private_subnet_cidrs = var.private_subnet_cidrs
  single_nat_gateway   = var.single_nat_gateway
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

  environment                = var.environment
  project_name               = var.project_name
  db_name                    = var.db_name
  db_username                = var.db_username
  db_password                = var.db_password
  db_port                    = var.db_port
  db_instance_class          = var.db_instance_class
  db_allocated_storage       = var.db_allocated_storage
  db_engine_version          = var.db_engine_version
  multi_az                   = var.multi_az
  skip_final_snapshot        = var.skip_final_snapshot
  deletion_protection        = var.deletion_protection
  vpc_id                     = module.network.vpc_id
  subnet_ids                 = module.network.private_subnet_ids
  ingress_security_group_ids = [module.compute.api_security_group_id]

  depends_on = [module.network]
}

module "secrets" {
  source = "./modules/secrets"

  name        = var.project_name
  environment = var.environment
}

module "compute" {
  source = "./modules/compute"

  environment        = var.environment
  name               = var.project_name
  region             = var.region
  vpc_id             = module.network.vpc_id
  private_subnet_ids = module.network.private_subnet_ids

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

  depends_on = [module.network, module.ecr, module.secrets]
}
