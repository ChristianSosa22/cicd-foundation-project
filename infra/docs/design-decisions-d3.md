# Infrastructure Design Decisions

This document records the key architectural decisions made during the infra rewrite session (2026-06-03), including the options that were weighed and the rationale for each choice.

---

## Problem

The original Terraform configuration was generic: the compute module ran an **nginx placeholder** container on the **AWS default VPC** with no custom network. There was no module for networking, container registry, or secrets. The goal was to align the infrastructure with the real parking reservation application — a Node/Express API (`:8080`) and a Next.js frontend (`:3000`) backed by RDS PostgreSQL and an S3 receipts bucket.

---

## Decision Log

| # | Decision | Options Considered | Chosen | Rationale |
|---|---|---|---|---|
| 1 | **Network** | Keep default VPC / Custom VPC module | **Custom VPC module** | Default VPC is not production-grade, no subnet control, required by the spec. Custom VPC gives isolated network, correct public/private tier placement, and future ALB support. |
| 2 | **NAT topology** | Single NAT (shared) / One NAT per AZ | **Variable (`single_nat_gateway`)** | `true` for dev (cost saving: ~$32/month saved per extra AZ); `false` for production HA. Default is `true`. |
| 3 | **Workloads on ECS** | Backend only / Both api + web | **Both api and web on ECS Fargate** | The frontend uses `output: 'standalone'` — it is a Node server, not a static site. It cannot be hosted on plain S3+CloudFront without a code refactor. Both Dockerfiles exist and work. |
| 4 | **Ingress / Load Balancing** | Public IPs on tasks / ALB only for backend / ALB for both | **ALB (deferred to follow-up task)** | ALB is the correct production choice. Not implemented here to keep scope focused. The compute module exposes service names and SG IDs so the ALB task can wire target groups without changing this module. |
| 5 | **Container registry** | External registry / ECR | **ECR (new module)** | Local Docker images cannot be pulled by ECS. ECR is the standard AWS-native path. Image URI is composed in root main.tf as `<ecr_repo_url>:<tag>` — only the tag is a variable. |
| 6 | **Runtime secrets store** | GitHub Secrets only / AWS Secrets Manager / SSM Parameter Store | **SSM Parameter Store** | GitHub Secrets are for CI pipeline auth (build/deploy time) — separate concern. SSM SecureString parameters are injected into ECS tasks at container start via the `secrets` block. Free tier is sufficient for this app's handful of secrets. |
| 7 | **Secret value ownership (Pattern A)** | Values in Terraform variables (leak to state) / Manual console / Pattern A: TF owns resource, value out-of-band | **Pattern A** | Terraform owns the SSM parameter resource, its path, the IAM grant, and the ECS wiring — but NOT the value. Values are set once via `aws ssm put-parameter --overwrite`. `lifecycle { ignore_changes = [value] }` prevents Terraform from overwriting real values. Plaintext never enters `terraform.tfstate`. |

---

## Target Architecture

```
Internet
   │
 [IGW]  ──────────────────── public subnets (2 AZs)
   │                               │
   │                        [NAT Gateway]  ← EIP
   │
   └──  [ALB *]  ────────── private subnets (2 AZs)
                                   │
                    ┌──────────────┼──────────────┐
              [ECS api:8080]  [ECS web:3000]  [RDS Postgres]
                    │
              [S3 receipts bucket]   [SSM params]

* ALB = follow-up task (SG IDs and service names already exported)
```

---

## What is Out of Scope (Follow-up Tasks)

1. **ALB module**: Application Load Balancer + listener rules + target groups for api (`:8080`) and web (`:3000`). The compute module exports `api_service_name`, `web_service_name`, `api_security_group_id`, `web_security_group_id` for this.
2. **Schema apply step**: `backend/sql/schema.sql` must be run against RDS before the API starts. No migration runner is wired. Needs a one-off ECS task or CI step.
3. **VPC endpoints** for S3/ECR: Optional optimization to avoid NAT data transfer costs for internal AWS service calls.

---

## Notes for Future Operators

- **`NEXT_PUBLIC_API_URL` must be set at Docker build time** (it's baked into the Next.js JS bundle). Pass `--build-arg NEXT_PUBLIC_API_URL=<alb-url>` during `docker build`. Setting it as a container env var at runtime has no effect.
- The API runs an **in-process cron** (releases expired reservations every minute) and an **in-memory rate limiter** (120 req/60s). Both are per-replica — if you scale to multiple tasks, the cron fires N times (idempotent but worth knowing), and the rate limiter does not coordinate across replicas.
- The DB password is a Terraform variable used only to provision the RDS instance. The app-facing `DATABASE_URL` (which includes the password) is set separately in SSM out-of-band and never enters Terraform state.
