module "compute" {
  source      = "./modules/compute"
  environment = var.environment
  name        = var.project_name
  memory_size = 128
}

module "storage" {
  source      = "./modules/storage"
  environment = var.environment
  bucket_name = var.bucket_name_prefix
}