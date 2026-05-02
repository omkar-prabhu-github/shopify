#!/bin/bash
# Run this script ON the EC2 instance after SSH-ing in.
# Usage: bash server-setup.sh
set -e

echo "==> Updating system packages"
sudo apt-get update -y && sudo apt-get upgrade -y

echo "==> Installing Node.js 22 (LTS)"
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

echo "==> Installing PM2 + Nginx"
sudo npm install -g pm2
sudo apt-get install -y nginx certbot python3-certbot-nginx

echo "==> Cloning / pulling repo"
if [ -d "/home/ubuntu/axiom" ]; then
  cd /home/ubuntu/axiom && git pull
else
  git clone https://github.com/omkar-prabhu-github/axiom.git /home/ubuntu/axiom
  cd /home/ubuntu/axiom
fi

echo "==> Installing dependencies"
npm install

echo "==> Building frontend"
npm run build

echo "==> Writing .env.local (edit this with your real values)"
cat > /home/ubuntu/axiom/.env.local << 'ENVEOF'
NODE_ENV=production
PORT=3000
SHOPIFY_CLIENT_ID=YOUR_SHOPIFY_CLIENT_ID
SHOPIFY_CLIENT_SECRET=YOUR_SHOPIFY_CLIENT_SECRET
SHOPIFY_APP_URL=https://YOUR_DOMAIN_OR_EC2_IP
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
GEMINI_API_KEY_FALLBACK=YOUR_GEMINI_FALLBACK_KEY
ENVEOF

echo "==> Starting app with PM2"
cd /home/ubuntu/axiom
pm2 start ecosystem.config.cjs --env production
pm2 save
pm2 startup systemd -u ubuntu --hp /home/ubuntu | tail -1 | sudo bash

echo "==> Configuring Nginx"
sudo tee /etc/nginx/sites-available/axiom > /dev/null << 'NGINXEOF'
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 120s;
    }
}
NGINXEOF

sudo ln -sf /etc/nginx/sites-available/axiom /etc/nginx/sites-enabled/axiom
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl restart nginx
sudo systemctl enable nginx

echo ""
echo "✅ Server setup complete!"
echo ""
echo "Next steps:"
echo "  1. Edit /home/ubuntu/axiom/.env.local with your real values"
echo "  2. pm2 restart axiom"
echo "  3. If you have a domain: sudo certbot --nginx -d yourdomain.com"
echo "  4. Update SHOPIFY_APP_URL in .env.local to https://yourdomain.com"
echo "  5. Update redirect URL in Shopify Partner Dashboard"
