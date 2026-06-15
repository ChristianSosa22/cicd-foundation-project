# SSM Jump Host — private EC2 for database access via SSM port forwarding.
# No SSH key, no inbound security group rules, no public IP.
# Access is exclusively through AWS Systems Manager Session Manager,
# which provides an encrypted tunnel, IAM-controlled access, and CloudTrail audit logs.

# Official AWS SSM parameter path for the latest Amazon Linux 2023 AMI.
# Using the SSM parameter (rather than an AMI data source filter) guarantees
# the returned AMI is the AWS-recommended build with the SSM agent pre-installed.
data "aws_ssm_parameter" "amazon_linux" {
  name = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64"
}

# ── IAM: allow EC2 to register with SSM ───────────────────────────────────────
resource "aws_iam_role" "ssm_jump" {
  name = "${var.name}-${var.environment}-ssm-jump-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = {
    Environment = var.environment
    Purpose     = "ssm-jump-host"
    ManagedBy   = "terraform"
  }
}

# Grants the instance the SSM core capabilities: register, receive commands,
# open sessions. Read-only on Parameter Store is included so the instance
# can resolve SSM parameters if needed.
resource "aws_iam_role_policy_attachment" "ssm_jump_core" {
  role       = aws_iam_role.ssm_jump.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "ssm_jump" {
  name = "${var.name}-${var.environment}-ssm-jump-profile"
  role = aws_iam_role.ssm_jump.name
}

# ── EC2 instance ───────────────────────────────────────────────────────────────
resource "aws_instance" "ssm_jump" {
  ami                    = data.aws_ssm_parameter.amazon_linux.value
  instance_type          = "t3.micro"
  subnet_id              = var.subnet_id
  iam_instance_profile   = aws_iam_instance_profile.ssm_jump.name
  vpc_security_group_ids = [var.security_group_id]

  # No key_name — SSH is intentionally disabled. All access goes through SSM.
  # user_data explicitly enables and starts the SSM agent to ensure it is
  # running even if the instance boots before cloud-init completes fully.
  user_data = base64encode(<<-EOF
    #!/bin/bash
    systemctl enable amazon-ssm-agent
    systemctl start amazon-ssm-agent
  EOF
  )

  root_block_device {
    volume_type = "gp3"
    encrypted   = true
  }

  tags = {
    Name        = "${var.name}-${var.environment}-ssm-jump"
    Environment = var.environment
    Purpose     = "ssm-jump-host"
    ManagedBy   = "terraform"
  }
}
