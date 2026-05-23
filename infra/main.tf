module "compute" {
  source      = "./modules/compute"
  environment = var.environment
  name        = var.project_name
  cpu         = 256
  memory      = 512
  region      = var.region
}

module "storage" {
  source      = "./modules/storage"
  environment = var.environment
  bucket_name = var.bucket_name_prefix
}

module "database" {
  source               = "./modules/database"
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
}