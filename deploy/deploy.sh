#!/bin/bash
# Deploy leads_generator to Ubuntu server
# Safe: idempotent — never modifies existing nginx sites or other app directories

set -e

DOMAIN="leads-generator.yourdomain.com"
APP_DIR="/var/www/leads_generator"
REPO="https://github.com/DTarasescu/leads_generator.git"
NGINX_CONF="/etc/nginx/sites-available/leads-generator.conf"
NGINX_ENABLED="/etc/nginx/sites-enabled/leads-generator.conf"

echo "=== Step 1: Install Node.js 20 (if not present) ==="
if ! command -v node &>/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
else
  echo "Node.js already installed: $(node --version)"
fi

echo "=== Step 2: Install PM2 (if not present) ==="
if ! command -v pm2 &>/dev/null; then
  sudo npm install -g pm2
else
  echo "PM2 already installed: $(pm2 --version)"
fi

echo "=== Step 3: Clone or update repo ==="
if [ -d "$APP_DIR/.git" ]; then
  echo "Repo exists — pulling latest..."
  cd "$APP_DIR" && git pull
else
  sudo mkdir -p "$APP_DIR"
  sudo chown "$USER":"$USER" "$APP_DIR"
  git clone "$REPO" "$APP_DIR"
fi

echo "=== Step 4: Install dependencies ==="
cd "$APP_DIR"
npm ci --omit=dev

echo "=== Step 5: Check .env.local exists ==="
if [ ! -f "$APP_DIR/.env.local" ]; then
  echo ""
  echo "ERROR: $APP_DIR/.env.local not found."
  echo "  cp $APP_DIR/.env.example $APP_DIR/.env.local"
  echo "  nano $APP_DIR/.env.local"
  exit 1
fi

echo "=== Step 6: Build Next.js ==="
cd "$APP_DIR"
npm run build

echo "=== Step 7: Create log directory ==="
sudo mkdir -p /var/log/leads-generator

echo "=== Step 8: Add nginx site (skips if already exists) ==="
if [ -f "$NGINX_CONF" ]; then
  echo "nginx config already exists, skipping."
else
  sudo tee "$NGINX_CONF" > /dev/null <<NGINXEOF
server {
    listen 80;
    server_name $DOMAIN;
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl;
    server_name $DOMAIN;

    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:3400;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
NGINXEOF
  echo "nginx config created."
fi

if [ ! -L "$NGINX_ENABLED" ]; then
  sudo ln -s "$NGINX_CONF" "$NGINX_ENABLED"
  echo "nginx site enabled."
fi

echo "=== Step 9: Issue SSL certificate (skips if already exists) ==="
if [ ! -d "/etc/letsencrypt/live/$DOMAIN" ]; then
  sudo certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m gabriel.tarasescu@gmail.com
else
  echo "SSL cert already exists, skipping."
fi

echo "=== Step 10: Reload nginx ==="
sudo nginx -t && sudo systemctl reload nginx

echo "=== Step 11: Start or reload app with PM2 ==="
cd "$APP_DIR"
if pm2 list | grep -q "leads-generator"; then
  pm2 reload leads-generator
else
  pm2 start deploy/ecosystem.config.js
fi

echo "=== Step 12: Save PM2 config and enable on boot ==="
pm2 save
sudo env PATH="$PATH:/usr/bin" pm2 startup systemd -u "$USER" --hp "$HOME" | tail -1 | sudo bash

echo ""
echo "Done! App is live at https://$DOMAIN"
