#!/usr/bin/env bash
# NowCart — EC2 bootstrap script
#
# Run this ONCE on a fresh Ubuntu 22.04 LTS instance to stand up everything
# the GitHub Actions deploy pipeline (.github/workflows/deploy.yml) expects:
# nginx reverse proxy, redis, the app checked out at /opt/nowcart, and a
# `nowcart` systemd unit. After this script finishes, pushes to `master`
# will `git pull` + `systemctl restart nowcart` as usual — no more manual
# steps needed on this box.
#
# Usage: ssh onto the new instance, then:
#   curl -fsSL https://raw.githubusercontent.com/Strizzyy/NowCart/master/scripts/bootstrap_ec2.sh | sudo bash
# or copy this file over and run: sudo bash bootstrap_ec2.sh

set -euo pipefail

REPO_URL="https://github.com/Strizzyy/NowCart.git"
APP_DIR="/opt/nowcart"
SERVICE_USER="ubuntu"

echo "[1/7] Updating packages..."
apt-get update -y
apt-get install -y git nginx redis-server curl python3-pip

echo "[2/7] Installing uv (Python package manager)..."
curl -LsSf https://astral.sh/uv/install.sh | env UV_INSTALL_DIR=/usr/local/bin sh

echo "[3/7] Cloning repo to ${APP_DIR}..."
if [ -d "${APP_DIR}/.git" ]; then
  git -C "${APP_DIR}" pull origin master
else
  git clone "${REPO_URL}" "${APP_DIR}"
fi
chown -R ${SERVICE_USER}:${SERVICE_USER} "${APP_DIR}"

echo "[4/7] Installing Python dependencies..."
cd "${APP_DIR}/server"
sudo -u ${SERVICE_USER} /usr/local/bin/uv sync

echo "[5/7] Enabling Redis..."
systemctl enable redis-server
systemctl start redis-server

echo "[6/7] Writing nginx reverse-proxy config..."
cat > /etc/nginx/sites-available/nowcart <<'EOF'
server {
    listen 80 default_server;
    server_name _;

    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /health {
        proxy_pass http://127.0.0.1:8000;
    }
}
EOF
ln -sf /etc/nginx/sites-available/nowcart /etc/nginx/sites-enabled/nowcart
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx
systemctl enable nginx

echo "[7/7] Writing systemd unit..."
cat > /etc/systemd/system/nowcart.service <<EOF
[Unit]
Description=NowCart FastAPI backend
After=network.target redis-server.service

[Service]
Type=simple
User=${SERVICE_USER}
WorkingDirectory=${APP_DIR}/server
EnvironmentFile=-/etc/nowcart.env
ExecStart=${APP_DIR}/server/.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# The .env file will be written by GitHub Actions on the next deploy
# (see .github/workflows/deploy.yml). Create an empty placeholder so the
# service doesn't fail to start before the first CI-driven deploy.
touch /etc/nowcart.env
chmod 600 /etc/nowcart.env

systemctl daemon-reload
systemctl enable nowcart

echo ""
echo "=========================================================="
echo " Bootstrap complete."
echo " nowcart.service will start once GitHub Actions writes"
echo " /etc/nowcart.env on the next push to master (or run"
echo " 'sudo systemctl start nowcart' manually after creating"
echo " /etc/nowcart.env by hand for a one-off test)."
echo "=========================================================="
