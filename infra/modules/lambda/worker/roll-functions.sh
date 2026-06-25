#!/usr/bin/env bash
# Roll the worker Lambda functions onto a freshly pushed image.
#
# Terraform sets image_uri only at create time (ignore_changes = [image_uri]),
# mirroring how the ECS services keep their task-definition image stable in TF
# and are rolled by CI. After pushing a new image, CI calls this to point each
# function at the new digest and waits for the update to finish.
#
# Usage: roll-functions.sh <aws-region> <image_uri> <function-name>...
set -euo pipefail

REGION="${1:?usage: roll-functions.sh <region> <image_uri> <function>...}"
IMAGE_URI="${2:?usage: roll-functions.sh <region> <image_uri> <function>...}"
shift 2

for NAME in "$@"; do
  echo "Rolling ${NAME} -> ${IMAGE_URI}"
  aws lambda update-function-code \
    --function-name "$NAME" \
    --image-uri "$IMAGE_URI" \
    --region "$REGION" >/dev/null
  aws lambda wait function-updated --function-name "$NAME" --region "$REGION"
  echo "  ${NAME} updated."
done
