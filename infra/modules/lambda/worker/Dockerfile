# ── Worker Lambda container image ──────────────────────────────────────────────
# One image serves all three async workers (receipt / release / email). Each
# Lambda selects its handler at runtime via image_config.command in Terraform,
# so there is a single artifact to build, push and roll.
#
# Dependencies (pg, pdf-lib, qrcode) are baked in at build time with `npm ci`
# against a committed lockfile. A missing dependency fails the build here — it
# can never reach AWS as an empty layer, which was the root cause of the
# receipt-worker "Cannot find module 'pg'" failures.
#
# The @aws-sdk/* clients the handlers require are provided by the AWS base image,
# matching the previous zip+layer behaviour where they came from the runtime.
#
# Build context is infra/modules/lambda (parent of this dir) so the image can
# COPY both the shared deps (worker/) and the handler sources (handlers/):
#   docker build -f worker/Dockerfile -t <repo>:<tag> .
FROM public.ecr.aws/lambda/nodejs:20

# Install production dependencies into the Lambda task root.
COPY worker/package.json worker/package-lock.json ${LAMBDA_TASK_ROOT}/
RUN npm ci --omit=dev

# Handler sources. All three live in the same image; the active one is chosen
# per-function by image_config.command (e.g. ["receipt.handler"]).
COPY handlers/receipt.js handlers/release.js handlers/email.js ${LAMBDA_TASK_ROOT}/

# Default handler; overridden per-function by Terraform's image_config.command.
CMD [ "receipt.handler" ]
