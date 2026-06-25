#!/usr/bin/env bash
# Build and push the shared worker Lambda container image to ECR.
#
# Owns the worker ECR repository idempotently (creates it if missing) so the
# image always exists BEFORE Terraform creates/updates the image-based Lambda
# functions — Lambda validates image_uri at CreateFunction time, so the artifact
# must pre-exist. This is why the worker repo is managed here rather than as a
# Terraform resource (a single apply cannot push an image between creating the
# repo and creating the function).
#
# Usage:   push-image.sh <environment> <aws-region>
# Stdout:  a single line  image_uri=<repo>@<digest>   (append to $GITHUB_OUTPUT)
# Stderr:  all build/login/push progress.
set -euo pipefail

ENVIRONMENT="${1:?usage: push-image.sh <environment> <aws-region>}"
REGION="${2:?usage: push-image.sh <environment> <aws-region>}"

# Build context is the lambda module dir (parent of this script's dir): it holds
# both worker/ (deps + Dockerfile) and handlers/ (the handler sources).
MODULE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$MODULE_DIR"

ACCOUNT="$(aws sts get-caller-identity --query Account --output text)"
REGISTRY="${ACCOUNT}.dkr.ecr.${REGION}.amazonaws.com"
REPO_NAME="oyd-project-${ENVIRONMENT}-workers"
REPO_URL="${REGISTRY}/${REPO_NAME}"
TAG="${GITHUB_SHA:-manual-$(date +%s)}"

{
  echo "Ensuring ECR repository ${REPO_NAME} exists..."
  aws ecr describe-repositories --repository-names "$REPO_NAME" --region "$REGION" >/dev/null 2>&1 || \
    aws ecr create-repository \
      --repository-name "$REPO_NAME" \
      --region "$REGION" \
      --image-scanning-configuration scanOnPush=true \
      --image-tag-mutability MUTABLE >/dev/null

  echo "Logging in to ${REGISTRY}..."
  aws ecr get-login-password --region "$REGION" | \
    docker login --username AWS --password-stdin "$REGISTRY"

  echo "Building worker image (${REPO_URL}:${TAG})..."
  docker build -f worker/Dockerfile -t "${REPO_URL}:latest" -t "${REPO_URL}:${TAG}" .

  echo "Pushing ${REPO_URL}:latest and :${TAG}..."
  docker push "${REPO_URL}:latest"
  docker push "${REPO_URL}:${TAG}"
} >&2

# Resolve the immutable digest of what we just pushed so the function rolls onto
# an exact, content-addressed image rather than a moving tag.
DIGEST="$(aws ecr describe-images \
  --repository-name "$REPO_NAME" \
  --image-ids imageTag="$TAG" \
  --region "$REGION" \
  --query 'imageDetails[0].imageDigest' \
  --output text)"

echo "image_uri=${REPO_URL}@${DIGEST}"
