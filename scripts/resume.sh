#!/usr/bin/env bash
# Resume all services after a pause.
# Run: bash scripts/resume.sh
set -euo pipefail

CLUSTER="oyd-project-dev-cluster"
REGION="us-east-1"
DB_ID="oyd-project-dev-db"

echo "==> Starting RDS instance..."
aws rds start-db-instance \
  --db-instance-identifier "$DB_ID" \
  --region "$REGION" \
  --output text --query 'DBInstance.DBInstanceStatus' | xargs -I{} echo "  RDS status: {}"

echo "==> Waiting for RDS to be available (~3-5 min)..."
aws rds wait db-instance-available \
  --db-instance-identifier "$DB_ID" \
  --region "$REGION"
echo "  RDS is available."

echo "==> Scaling ECS services back up..."
for SVC in oyd-project-dev-api-svc oyd-project-dev-web-svc oyd-project-dev-worker-svc; do
  aws ecs update-service \
    --cluster "$CLUSTER" \
    --service "$SVC" \
    --desired-count 1 \
    --region "$REGION" \
    --output text --query 'service.serviceName' | xargs -I{} echo "  started: {}"
done

echo ""
echo "Done. Services are starting up (allow ~2 min for health checks to pass)."
