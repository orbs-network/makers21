#!/bin/bash
set -euo pipefail

# Provisions an EC2 instance for makers21 server (mediasoup SFU + Express + WS).
# Bootstraps Node 20, build tools, mediasoup native deps, and a systemd unit.
# After the instance is up: attach your existing Elastic IP, deploy the app code
# (git clone + npm install + npm run build at the repo root), then start the service.

INSTANCE_NAME="makers21-v2"
REGION="eu-central-1"
INSTANCE_TYPE="c7g.medium"           # 1 vCPU dedicated (Graviton ARM), 2 GB RAM
DISK_SIZE=32                          # gp3 — 32 GB is plenty
KEY_NAME="OrbsSharedSSHKey"
SSH_PUB_KEY_PATH="$HOME/.ssh/OrbsSharedSSH.pub"
ARCH="arm64"                          # MUST match c7g (Graviton)

# Ubuntu 22.04 LTS AMI for matching architecture
AMI_ID=$(aws ec2 describe-images \
  --region "$REGION" \
  --owners 099720109477 \
  --filters "Name=name,Values=ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-${ARCH}-server-*" \
             "Name=state,Values=available" \
  --query 'Images | sort_by(@, &CreationDate) | [-1].ImageId' \
  --output text)
echo "Using AMI: $AMI_ID ($ARCH)"

# Import SSH key if not already present
if ! aws ec2 describe-key-pairs --region "$REGION" --key-names "$KEY_NAME" &>/dev/null; then
  echo "Importing SSH key $KEY_NAME..."
  OPENSSH_PUB_B64=$(ssh-keygen -i -m PKCS8 -f "$SSH_PUB_KEY_PATH" | base64)
  aws ec2 import-key-pair \
    --region "$REGION" \
    --key-name "$KEY_NAME" \
    --public-key-material "$OPENSSH_PUB_B64"
else
  echo "SSH key $KEY_NAME already exists in $REGION"
fi

# --- Security group ---
SG_NAME="makers21-v2-sg"
SG_ID=$(aws ec2 describe-security-groups \
  --region "$REGION" \
  --filters "Name=group-name,Values=$SG_NAME" \
  --query 'SecurityGroups[0].GroupId' \
  --output text 2>/dev/null || echo "None")

if [ "$SG_ID" = "None" ] || [ -z "$SG_ID" ]; then
  echo "Creating security group $SG_NAME..."
  SG_ID=$(aws ec2 create-security-group \
    --region "$REGION" \
    --group-name "$SG_NAME" \
    --description "makers21-v2 - Express + WS + mediasoup SFU" \
    --query 'GroupId' \
    --output text)

  # SSH
  aws ec2 authorize-security-group-ingress --region "$REGION" --group-id "$SG_ID" \
    --protocol tcp --port 22 --cidr 0.0.0.0/0

  # HTTP — Let's Encrypt + redirect to HTTPS (kept open even when fronted by Fastly)
  aws ec2 authorize-security-group-ingress --region "$REGION" --group-id "$SG_ID" \
    --protocol tcp --port 80 --cidr 0.0.0.0/0

  # HTTPS — direct browser access if not behind a CDN (also harmless if you're using Fastly)
  aws ec2 authorize-security-group-ingress --region "$REGION" --group-id "$SG_ID" \
    --protocol tcp --port 443 --cidr 0.0.0.0/0

  # Backend HTTP/WS — server listens on 4000. If you front this with Fastly,
  # you can lock this down to Fastly's IP ranges later. Open to world for now.
  aws ec2 authorize-security-group-ingress --region "$REGION" --group-id "$SG_ID" \
    --protocol tcp --port 4000 --cidr 0.0.0.0/0

  # mediasoup RTC media — UDP preferred, TCP fallback for restrictive firewalls.
  # MUST be reachable directly from clients (cannot proxy through Fastly).
  aws ec2 authorize-security-group-ingress --region "$REGION" --group-id "$SG_ID" \
    --protocol udp --port 40000-49999 --cidr 0.0.0.0/0

  aws ec2 authorize-security-group-ingress --region "$REGION" --group-id "$SG_ID" \
    --protocol tcp --port 40000-49999 --cidr 0.0.0.0/0

  echo "Security group created: $SG_ID"
else
  echo "Security group $SG_NAME already exists: $SG_ID"
fi

# --- Bootstrap (cloud-init user-data) ---
USER_DATA=$(cat <<'USERDATA'
#!/bin/bash
set -e

# --- Kernel tuning for many concurrent connections ---
cat >> /etc/sysctl.conf <<'SYSCTL'
fs.file-max = 65535
net.core.somaxconn = 65535
net.core.netdev_max_backlog = 65535
net.ipv4.tcp_max_syn_backlog = 65535
net.ipv4.ip_local_port_range = 1024 65535
net.ipv4.tcp_tw_reuse = 1
net.ipv4.tcp_fin_timeout = 15
net.ipv4.tcp_keepalive_time = 300
net.ipv4.tcp_keepalive_intvl = 30
net.ipv4.tcp_keepalive_probes = 5
SYSCTL
sysctl -p

cat >> /etc/security/limits.conf <<'LIMITS'
* soft nofile 65535
* hard nofile 65535
LIMITS

# --- System packages ---
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y \
  git nginx certbot python3-certbot-nginx \
  build-essential python3 python3-pip pkg-config

# --- Node 22 (current LTS; latest mediasoup-client requires >=22) ---
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs

# --- Nginx ---
# Two server blocks (matches the existing deepstream setup):
#  - HTTP origin for makers21.orbs.com on :80 (Fastly is fronting this)
#  - WSS endpoint on ws-makers.orbs.com:443 with Let's Encrypt cert (bypasses Fastly)
# The actual nginx.conf is shipped in the repo at server/nginx/nginx.conf
# and copied into place by the deploy step (after git clone).
# This bootstrap just makes sure nginx is installed and ready.

systemctl enable nginx

# --- systemd unit for server ---
# The deploy step (git clone, npm install, npm run build) is performed
# AFTER this bootstrap completes. The unit defaults to /home/ubuntu/makers21
# (i.e. the repo cloned as-is). If you clone elsewhere, edit
# /etc/systemd/system/makers21.service afterward.
cat > /etc/systemd/system/makers21.service <<'SERVICE'
[Unit]
Description=Makers21 server
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/makers21/server
ExecStart=/usr/bin/node index.js
Restart=on-failure
RestartSec=5
LimitNOFILE=65535
Environment=NODE_ENV=production
# WS goes through ws-makers.orbs.com (nginx terminates TLS, bypasses Fastly).
# The /runtime-config.js endpoint serves this to the lobby + game pages.
Environment=WS_URL=wss://ws-makers.orbs.com/ws
# mediasoup advertises this IP to WebRTC clients in ICE candidates.
# MUST be the instance's public/Elastic IP (clients can't reach 0.0.0.0).
# Set this AFTER attaching the EIP, then `sudo systemctl daemon-reload && sudo systemctl restart makers21`.
Environment=ANNOUNCED_IP=3.120.234.202

[Install]
WantedBy=multi-user.target
SERVICE

systemctl daemon-reload
# Don't start yet — code isn't deployed.
# Run `systemctl start makers21` after the post-deploy step.

echo "Bootstrap complete. Next: deploy app code, then 'systemctl start makers21'."
USERDATA
)

# --- Launch ---
echo "Launching EC2 instance..."
INSTANCE_ID=$(aws ec2 run-instances \
  --region "$REGION" \
  --image-id "$AMI_ID" \
  --instance-type "$INSTANCE_TYPE" \
  --key-name "$KEY_NAME" \
  --security-group-ids "$SG_ID" \
  --block-device-mappings "DeviceName=/dev/sda1,Ebs={VolumeSize=$DISK_SIZE,VolumeType=gp3}" \
  --user-data "$USER_DATA" \
  --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=$INSTANCE_NAME},{Key=owner,Value=orbs},{Key=description,Value=makers21 v2 SFU}]" \
  --query 'Instances[0].InstanceId' \
  --output text)

echo "Instance ID: $INSTANCE_ID"
echo "Waiting for instance to be running..."
aws ec2 wait instance-running --region "$REGION" --instance-ids "$INSTANCE_ID"

PUBLIC_IP=$(aws ec2 describe-instances \
  --region "$REGION" \
  --instance-ids "$INSTANCE_ID" \
  --query 'Reservations[0].Instances[0].PublicIpAddress' \
  --output text)

echo ""
echo "============================================"
echo "  Instance Name:  $INSTANCE_NAME"
echo "  Instance ID:    $INSTANCE_ID"
echo "  Public IP:      $PUBLIC_IP   (attach your existing Elastic IP if reusing)"
echo "  Region:         $REGION"
echo "  Type:           $INSTANCE_TYPE ($ARCH)"
echo "============================================"
echo ""
echo "Ports open:"
echo "  22                TCP   SSH"
echo "  80                TCP   HTTP (nginx → :4000, also for Let's Encrypt)"
echo "  443               TCP   HTTPS (if doing TLS on the box)"
echo "  4000              TCP   server backend"
echo "  40000-49999       UDP   mediasoup RTC (primary)"
echo "  40000-49999       TCP   mediasoup RTC (fallback)"
echo ""
echo "Next steps:"
echo "  1. Attach your Elastic IP:"
echo "     aws ec2 associate-address --region $REGION --instance-id $INSTANCE_ID --allocation-id eipalloc-XXXXXXX"
echo ""
echo "  2. Set the announced address in server/config.js to your Elastic IP."
echo ""
echo "  3. Deploy app code:"
echo "     ssh ubuntu@<EIP>"
echo "     git clone <repo> /home/ubuntu/makers21"
echo "     cd /home/ubuntu/makers21 && npm install && npm run build"
echo "     cd /home/ubuntu/makers21/server && npm install"
echo "     sudo cp /home/ubuntu/makers21/server/nginx/nginx.conf /etc/nginx/nginx.conf"
echo "     sudo systemctl restart nginx"
echo "     sudo systemctl start makers21 && sudo systemctl enable makers21"
echo ""
echo "  4. Provision (or restore) the Let's Encrypt cert for ws-makers.orbs.com:"
echo "     sudo certbot --nginx -d ws-makers.orbs.com"
echo ""
echo "  5. Update Fastly: change backend host in the VCL from the old EIP"
echo "     (3.120.234.202) to the new Elastic IP. Backend port stays at 80."
echo "     The VCL itself doesn't need any changes."
echo "============================================"
