# Staging environment values — mirrors production-like settings.
# Sensitive vars (db_password) are supplied at runtime via TF_VAR_db_password
# or a CI environment secret (STAGING_DB_PASSWORD) — never committed to this file.

# ── Project ───────────────────────────────────────────────────────────────────
environment  = "staging"
project_name = "oyd-project"
region       = "us-east-1"

# ── Network ───────────────────────────────────────────────────────────────────
vpc_cidr                  = "10.0.0.0/16"
az_count                  = 2
public_subnet_cidrs       = ["10.0.0.0/24", "10.0.1.0/24"]
private_app_subnet_cidrs  = ["10.0.11.0/24", "10.0.12.0/24"]
private_data_subnet_cidrs = ["10.0.21.0/24", "10.0.22.0/24"]
single_nat_gateway        = false # redundant NAT per AZ for staging HA
enable_nat_gateway        = false # no NAT — ECS tasks run in public subnets
create_vpc_endpoints      = true  # VPC Endpoints for Lambda access to SQS/SNS/S3/SecretsManager/SSM/Logs

# ── Database ──────────────────────────────────────────────────────────────────
db_name              = "parking"
db_username          = "parking_user"
db_engine_version    = "16.14"
db_instance_class    = "db.t3.small" # larger than dev for realistic load testing
db_allocated_storage = 20
multi_az             = true # automatic failover enabled
skip_final_snapshot  = false
deletion_protection  = true

# ── Compute ───────────────────────────────────────────────────────────────────
# Staging uses larger Fargate tasks to validate performance under realistic load.
api_image_tag = "latest"
web_image_tag = "latest"
api_cpu       = 512
api_memory    = 1024
web_cpu       = 256
web_memory    = 512

# ── Async Messaging ───────────────────────────────────────────────────────────
# Staging uses longer message retention (7 days) to match production SLAs and
# allow more time for manual DLQ inspection before messages expire.
max_receive_count                  = 3
dlq_message_retention_seconds      = 1209600 # 14 days
receipt_visibility_timeout_seconds = 90      # higher timeout for staging load
receipt_message_retention_seconds  = 604800  # 7 days
release_visibility_timeout_seconds = 60      # higher timeout for staging load
release_message_retention_seconds  = 604800  # 7 days
email_visibility_timeout_seconds   = 60      # higher timeout for staging load
email_message_retention_seconds    = 604800  # 7 days

# ── Scheduler ─────────────────────────────────────────────────────────────────
schedule_expression      = "rate(20 minutes)"
scheduler_timezone       = "America/Guatemala"
scheduler_target_message = "{\"event_type\":\"ReleaseExpiredReservationCommand\",\"data\":{}}"
