#!/bin/bash
# Run this on your LOCAL machine to launch the EC2 instance.
# Prerequisites: AWS CLI configured (aws configure)
# Usage: bash scripts/deploy-ec2.sh
set -e

# ── CONFIG — edit these ──────────────────────────────────────────
REGION="us-east-1"          # Change to your preferred region
INSTANCE_TYPE="t3.micro"    # Free-tier eligible
KEY_NAME="axiom-key"        # SSH key pair name (will be created)
SG_NAME="axiom-sg"          # Security group name
AMI_ID=""                   # Leave empty — script fetches latest Ubuntu 22.04
# ────────────────────────────────────────────────────────────────

AWS=~/.local/bin/aws

echo "==> Using region: $REGION"

# Fetch latest Ubuntu 22.04 LTS AMI
if [ -z "$AMI_ID" ]; then
  echo "==> Fetching latest Ubuntu 22.04 LTS AMI for $REGION..."
  AMI_ID=$($AWS ec2 describe-images \
    --region "$REGION" \
    --owners 099720109477 \
    --filters "Name=name,Values=ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*" \
              "Name=state,Values=available" \
    --query "sort_by(Images, &CreationDate)[-1].ImageId" \
    --output text)
  echo "==> AMI: $AMI_ID"
fi

# Create SSH key pair
echo "==> Creating SSH key pair: $KEY_NAME"
KEY_FILE="$HOME/.ssh/${KEY_NAME}.pem"
if [ ! -f "$KEY_FILE" ]; then
  $AWS ec2 create-key-pair \
    --region "$REGION" \
    --key-name "$KEY_NAME" \
    --query "KeyMaterial" \
    --output text > "$KEY_FILE"
  chmod 400 "$KEY_FILE"
  echo "==> Key saved to $KEY_FILE"
else
  echo "==> Key already exists at $KEY_FILE"
fi

# Create security group
echo "==> Creating security group: $SG_NAME"
SG_ID=$($AWS ec2 create-security-group \
  --region "$REGION" \
  --group-name "$SG_NAME" \
  --description "Axiom app security group" \
  --query "GroupId" \
  --output text 2>/dev/null || \
  $AWS ec2 describe-security-groups \
    --region "$REGION" \
    --group-names "$SG_NAME" \
    --query "SecurityGroups[0].GroupId" \
    --output text)
echo "==> Security Group ID: $SG_ID"

# Allow SSH (22), HTTP (80), HTTPS (443)
echo "==> Opening ports 22, 80, 443"
for PORT in 22 80 443; do
  $AWS ec2 authorize-security-group-ingress \
    --region "$REGION" \
    --group-id "$SG_ID" \
    --protocol tcp \
    --port "$PORT" \
    --cidr 0.0.0.0/0 2>/dev/null || true
done

# Launch EC2 instance
echo "==> Launching $INSTANCE_TYPE instance..."
INSTANCE_ID=$($AWS ec2 run-instances \
  --region "$REGION" \
  --image-id "$AMI_ID" \
  --instance-type "$INSTANCE_TYPE" \
  --key-name "$KEY_NAME" \
  --security-group-ids "$SG_ID" \
  --block-device-mappings '[{"DeviceName":"/dev/sda1","Ebs":{"VolumeSize":20,"VolumeType":"gp3"}}]' \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=axiom-app}]' \
  --query "Instances[0].InstanceId" \
  --output text)
echo "==> Instance launched: $INSTANCE_ID"

# Wait for instance to be running
echo "==> Waiting for instance to be running..."
$AWS ec2 wait instance-running --region "$REGION" --instance-ids "$INSTANCE_ID"

# Get public IP
PUBLIC_IP=$($AWS ec2 describe-instances \
  --region "$REGION" \
  --instance-ids "$INSTANCE_ID" \
  --query "Reservations[0].Instances[0].PublicIpAddress" \
  --output text)

echo ""
echo "✅ EC2 instance is running!"
echo ""
echo "   Instance ID : $INSTANCE_ID"
echo "   Public IP   : $PUBLIC_IP"
echo "   Key file    : $KEY_FILE"
echo "   Region      : $REGION"
echo ""
echo "══════════════════════════════════════════════════"
echo "NEXT STEPS:"
echo "══════════════════════════════════════════════════"
echo ""
echo "1. Wait ~30 seconds for the instance to fully boot, then SSH in:"
echo "   ssh -i $KEY_FILE ubuntu@$PUBLIC_IP"
echo ""
echo "2. Upload the server setup script:"
echo "   scp -i $KEY_FILE scripts/server-setup.sh ubuntu@$PUBLIC_IP:~/"
echo ""
echo "3. On the server, run:"
echo "   bash server-setup.sh"
echo ""
echo "4. Push your code to GitHub first (if not done):"
echo "   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git"
echo "   git push -u origin main"
echo ""
echo "5. Set SHOPIFY_APP_URL=http://$PUBLIC_IP in .env.local on the server"
echo "   (or use a domain with HTTPS for production)"
echo ""
echo "6. Update Shopify Partner Dashboard redirect URL to:"
echo "   http://$PUBLIC_IP/api/auth/callback"
echo ""
echo "── Save this info ──────────────────────────────────"
echo "IP=$PUBLIC_IP"
echo "KEY=$KEY_FILE"
echo "ID=$INSTANCE_ID"
