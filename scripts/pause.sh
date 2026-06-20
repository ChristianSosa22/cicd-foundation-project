#!/usr/bin/env bash
# Pause all billable compute when the project is not in use.
# Saves ~$20/month (Fargate + RDS instance hours).
# Run: bash scripts/pause.sh
set -euo pipefail

CLUSTER="oyd-project-dev-cluster"
REGION="us-east-1"
DB_ID="oyd-project-dev-db"

echo "==> Scaling ECS services to 0..."
for SVC in oyd-project-dev-api-svc oyd-project-dev-web-svc oyd-project-dev-worker-svc; do
  aws ecs update-service \
    --cluster "$CLUSTER" \
    --service "$SVC" \
    --desired-count 0 \
    --region "$REGION" \
    --output text --query 'service.serviceName' | xargs -I{} echo "  stopped: {}"
done

echo "==> Stopping RDS instance (takes ~2 min)..."
aws rds stop-db-instance \
  --db-instance-identifier "$DB_ID" \
  --region "$REGION" \
  --output text --query 'DBInstance.DBInstanceStatus' | xargs -I{} echo "  RDS status: {}"

echo ""
echo "Done. Billing paused. ALB still charges ~\$0.25/day while idle."
echo "To resume: bash scripts/resume.sh"
