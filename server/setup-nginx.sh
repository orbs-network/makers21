#!/bin/bash
set -euo pipefail

DOMAIN="ws-makers.orbs.com"

echo "=== Setting up nginx + SSL for $DOMAIN ==="

# Install nginx and certbot if needed
if ! command -v nginx &>/dev/null; then
    echo "Installing nginx..."
    sudo apt-get update
    sudo apt-get install -y nginx
fi

if ! command -v certbot &>/dev/null; then
    echo "Installing certbot..."
    sudo apt-get update
    sudo apt-get install -y certbot
fi

# Get SSL certificate (stop nginx so certbot can use port 80)
if [ ! -d "/etc/letsencrypt/live/$DOMAIN" ]; then
    echo "Obtaining SSL certificate for $DOMAIN..."
    echo "Make sure DNS for $DOMAIN points to this server and port 80 is open."
    read -p "Press Enter to continue or Ctrl+C to abort..."
    sudo systemctl stop nginx 2>/dev/null || true
    sudo certbot certonly --standalone -d "$DOMAIN"
else
    echo "SSL certificate already exists for $DOMAIN"
fi

# Install nginx config
echo "Installing nginx config..."
sudo cp "$(dirname "$0")/nginx/nginx.conf" /etc/nginx/nginx.conf

# Test and start nginx
echo "Testing nginx config..."
sudo nginx -t

echo "Starting nginx..."
sudo systemctl enable nginx
sudo systemctl restart nginx

echo ""
echo "=== Done ==="
echo "  Port 80  -> static files from dist/ (Fastly origin for makers21.orbs.com)"
echo "  Port 443 -> WSS proxy to Deepstream:6020 ($DOMAIN)"
echo ""
echo "To renew cert automatically, add a cron:"
echo "  sudo crontab -e"
echo '  0 3 * * * certbot renew --pre-hook "systemctl stop nginx" --post-hook "systemctl start nginx" --quiet'
