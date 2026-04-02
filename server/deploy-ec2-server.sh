#!/bin/bash
set -euo pipefail

INSTANCE_NAME="makers26"
REGION="eu-central-1"
INSTANCE_TYPE="t3.micro"
DISK_SIZE=32
KEY_NAME="OrbsSharedSSH"
SSH_PUB_KEY_PATH="$HOME/.ssh/OrbsSharedSSH.pub"
AMI_ID="" # resolved below

# Ubuntu 22.04 LTS AMI (latest, x86_64) in eu-central-1
AMI_ID=$(aws ec2 describe-images \
  --region "$REGION" \
  --owners 099720109477 \
  --filters "Name=name,Values=ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*" \
             "Name=state,Values=available" \
  --query 'Images | sort_by(@, &CreationDate) | [-1].ImageId' \
  --output text)

echo "Using AMI: $AMI_ID"

# Import SSH key if not already present
if ! aws ec2 describe-key-pairs --region "$REGION" --key-names "$KEY_NAME" &>/dev/null; then
  echo "Importing SSH key $KEY_NAME..."
  # Convert PEM public key to OpenSSH format, then base64-encode for AWS CLI
  OPENSSH_PUB_B64=$(ssh-keygen -i -m PKCS8 -f "$SSH_PUB_KEY_PATH" | base64)
  aws ec2 import-key-pair \
    --region "$REGION" \
    --key-name "$KEY_NAME" \
    --public-key-material "$OPENSSH_PUB_B64"
else
  echo "SSH key $KEY_NAME already exists in $REGION"
fi

# Create security group if it doesn't exist
SG_NAME="makers26-sg"
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
    --description "makers26 - deepstream websocket + static server" \
    --query 'GroupId' \
    --output text)

  # SSH
  aws ec2 authorize-security-group-ingress --region "$REGION" --group-id "$SG_ID" \
    --protocol tcp --port 22 --cidr 0.0.0.0/0

  # HTTP (static resources)
  aws ec2 authorize-security-group-ingress --region "$REGION" --group-id "$SG_ID" \
    --protocol tcp --port 80 --cidr 0.0.0.0/0

  # Deepstream WebSocket (port 6020 is the default)
  aws ec2 authorize-security-group-ingress --region "$REGION" --group-id "$SG_ID" \
    --protocol tcp --port 6020 --cidr 0.0.0.0/0

  echo "Security group created: $SG_ID"
else
  echo "Security group $SG_NAME already exists: $SG_ID"
fi

# User data script to bootstrap the instance
USER_DATA=$(cat <<'USERDATA'
#!/bin/bash
set -e

# System tuning for websocket server
cat >> /etc/sysctl.conf <<'SYSCTL'
# Max open file descriptors
fs.file-max = 65535
# TCP tuning for websockets
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

# Raise file descriptor limits
cat >> /etc/security/limits.conf <<'LIMITS'
* soft nofile 65535
* hard nofile 65535
LIMITS

# Install Node.js 18 LTS
export DEBIAN_FRONTEND=noninteractive
apt-get update
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs git nginx

# Install pm2 globally
npm install -g pm2

# Configure nginx for static files on port 80
cat > /etc/nginx/sites-available/default <<'NGINX'
server {
    listen 80;
    server_name _;

    root /home/ubuntu/app/static;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }
}
NGINX

systemctl enable nginx
systemctl restart nginx

echo "Bootstrap complete"
USERDATA
)

# Launch the instance
echo "Launching EC2 instance..."
INSTANCE_ID=$(aws ec2 run-instances \
  --region "$REGION" \
  --image-id "$AMI_ID" \
  --instance-type "$INSTANCE_TYPE" \
  --key-name "$KEY_NAME" \
  --security-group-ids "$SG_ID" \
  --block-device-mappings "DeviceName=/dev/xvda,Ebs={VolumeSize=$DISK_SIZE,VolumeType=gp3}" \
  --user-data "$USER_DATA" \
  --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=$INSTANCE_NAME},{Key=owner,Value=orbs},{Key=description,Value=makers re-launch}]" \
  --query 'Instances[0].InstanceId' \
  --output text)

echo "Instance ID: $INSTANCE_ID"
echo "Waiting for instance to be running..."

aws ec2 wait instance-running --region "$REGION" --instance-ids "$INSTANCE_ID"

# Get public IP
PUBLIC_IP=$(aws ec2 describe-instances \
  --region "$REGION" \
  --instance-ids "$INSTANCE_ID" \
  --query 'Reservations[0].Instances[0].PublicIpAddress' \
  --output text)

echo ""
echo "============================================"
echo "  Instance Name:  $INSTANCE_NAME"
echo "  Instance ID:    $INSTANCE_ID"
echo "  Public IP:      $PUBLIC_IP"
echo "  Region:         $REGION"
echo "============================================"
echo ""
echo "SSH:  ssh -i ~/.ssh/OrbsSharedSSH ubuntu@$PUBLIC_IP"
echo ""
echo "Ports open:"
echo "  22   - SSH"
echo "  80   - Static HTTP"
echo "  6020 - Deepstream WebSocket"
echo "============================================"
