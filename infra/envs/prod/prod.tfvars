# Production environment values — all non-sensitive configuration.
# Sensitive vars (db_password) are supplied at runtime via TF_VAR_db_password
# or a CI environment secret (PROD_DB_PASSWORD) — never committed to this file.

# ── Project ───────────────────────────────────────────────────────────────────
environment  = "prod"
project_name = "oyd-project"
region       = "us-east-1"

# ── Network ───────────────────────────────────────────────────────────────────
vpc_cidr                  = "10.0.0.0/16"
az_count                  = 2
public_subnet_cidrs       = ["10.0.0.0/24", "10.0.1.0/24"]
private_app_subnet_cidrs  = ["10.0.11.0/24", "10.0.12.0/24"]
private_data_subnet_cidrs = ["10.0.21.0/24", "10.0.22.0/24"]
single_nat_gateway        = false
enable_nat_gateway        = false
create_vpc_endpoints      = true

# ── Database ──────────────────────────────────────────────────────────────────
db_name              = "parking"
db_username          = "parking_user"
db_engine_version    = "16.14"
db_instance_class    = "db.t3.small"
db_allocated_storage = 20
multi_az             = true
skip_final_snapshot  = false
deletion_protection  = true

# ── Compute ───────────────────────────────────────────────────────────────────
api_image_tag = "latest"
web_image_tag = "latest"
api_cpu       = 512
api_memory    = 1024
web_cpu       = 256
web_memory    = 512

# ── Async Worker ──────────────────────────────────────────────────────────────
worker_desired_count = 0

# ── Async Messaging ───────────────────────────────────────────────────────────
max_receive_count                  = 3
dlq_message_retention_seconds      = 1209600 # 14 days
receipt_visibility_timeout_seconds = 90
receipt_message_retention_seconds  = 604800 # 7 days
release_visibility_timeout_seconds = 60
release_message_retention_seconds  = 604800 # 7 days
email_visibility_timeout_seconds   = 60
email_message_retention_seconds    = 604800 # 7 days

# ── Scheduler ─────────────────────────────────────────────────────────────────
schedule_expression      = "rate(20 minutes)"
scheduler_timezone       = "America/Guatemala"
scheduler_target_message = "{\"event_type\":\"ReleaseExpiredReservationCommand\",\"data\":{}}"

# ── IAM module ─────────────────────────────────────────────────────────────────
github_repo = "ChristianSosa22/cicd-foundation-project"

# ── Observability ─────────────────────────────────────────────────────────────
alert_email                      = "christiansosa2204@gmail.com"
monthly_budget_limit             = "50"
observability_log_retention_days = 90

# ── TLS / HTTPS ───────────────────────────────────────────────────────────────
enable_tls       = true
domain_name      = "app.grupo5.oyd.solid.com.gt"
hosted_zone_name = "grupo5.oyd.solid.com.gt"
app_fqdn         = "app.grupo5.oyd.solid.com.gt"
ssl_policy       = "ELBSecurityPolicy-TLS13-1-2-2021-06"

# ── Lambda Module ─────────────────────────────────────────────────────────────
lambda_batch_size              = 10
lambda_maximum_batching_window = 0

# ── SES ────────────────────────────────────────────────────────────────────────
ses_from_address = "christiansosa2204@gmail.com"
