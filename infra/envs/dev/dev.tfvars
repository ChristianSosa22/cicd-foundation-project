# Dev environment values — all non-sensitive configuration.
# Sensitive vars (db_password) are supplied at runtime via TF_VAR_db_password
# or a CI secret — never committed to this file.

# ── Project ───────────────────────────────────────────────────────────────────
environment  = "dev"
project_name = "oyd-project"
region       = "us-east-1"

# ── Network ───────────────────────────────────────────────────────────────────
vpc_cidr                  = "10.0.0.0/16"
az_count                  = 2
public_subnet_cidrs       = ["10.0.0.0/24", "10.0.1.0/24"]
private_app_subnet_cidrs  = ["10.0.11.0/24", "10.0.12.0/24"] # ECS Fargate tasks
private_data_subnet_cidrs = ["10.0.21.0/24", "10.0.22.0/24"] # RDS (isolated, no NAT)
single_nat_gateway        = true                             # single NAT for dev cost savings; set false for prod HA

# ── Database ──────────────────────────────────────────────────────────────────
db_name              = "parking"
db_username          = "parking_user"
db_engine_version    = "16.14"
db_instance_class    = "db.t3.micro"
db_allocated_storage = 20
multi_az             = false
skip_final_snapshot  = true # allow clean teardown in dev
deletion_protection  = false

# ── Compute ───────────────────────────────────────────────────────────────────
# Dev uses minimum Fargate sizes to minimize cost. API and web each run at the
# smallest valid Fargate combination (256 CPU = 0.25 vCPU, 512 MB).
# Estimated Fargate cost per service: ~$8.90/month at 24/7 uptime.
api_image_tag = "latest"
web_image_tag = "latest"
api_cpu       = 256
api_memory    = 512
web_cpu       = 256
web_memory    = 512

# ── Async Messaging ───────────────────────────────────────────────────────────
# Dev uses shorter retention to reduce SQS storage costs; messages older than
# 4 days are discarded. max_receive_count=3 absorbs transient failures.
max_receive_count                  = 3
dlq_message_retention_seconds      = 1209600 # 14 days — long enough for manual redrive
receipt_visibility_timeout_seconds = 60      # PDF generation + S3 upload
receipt_message_retention_seconds  = 345600  # 4 days
release_visibility_timeout_seconds = 30      # batch UPDATE is fast
release_message_retention_seconds  = 345600  # 4 days
email_visibility_timeout_seconds   = 30      # email API call
email_message_retention_seconds    = 345600  # 4 days

# ── Scheduler ─────────────────────────────────────────────────────────────────
# Sweeps expired reservations every 20 minutes. Timezone set to Guatemala (CST)
# to align cron evaluation with local business hours.
schedule_expression      = "rate(20 minutes)"
scheduler_timezone       = "America/Guatemala"
scheduler_target_message = "{\"event_type\":\"ReleaseExpiredReservationCommand\",\"data\":{}}"
