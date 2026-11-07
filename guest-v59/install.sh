#!/usr/bin/env bash
set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "请使用 root 用户运行：bash install.sh"
  exit 1
fi

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
for required in tripmate-regions.js tripmate-ai-server.mjs tripmate-downloads.mjs tripmate-mvp.html tripmate-download.html tripmate-icon.png install-downloads.sh downloads-SHA256SUMS.txt; do
  [[ -s "$SCRIPT_DIR/$required" ]] || { echo "安装包不完整，缺少 $required。"; exit 1; }
done
bash "$SCRIPT_DIR/install-downloads.sh" --check

echo "[1/6] 安装系统组件"
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl gnupg nginx unzip

NODE_MAJOR=0
if command -v node >/dev/null 2>&1; then
  NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
fi
if (( NODE_MAJOR < 22 )); then
  echo "[2/6] 安装 Node.js 22"
  curl -fsSL https://deb.nodesource.com/setup_22.x -o /tmp/nodesource_setup.sh
  bash /tmp/nodesource_setup.sh
  apt-get install -y nodejs
else
  echo "[2/6] Node.js 已安装：$(node --version)"
fi
npm install -g @meituan-travel/travel-cli@1.0.16
MTTRAVEL_INSTALLED_BIN="$(command -v mttravel)"
if [[ "$MTTRAVEL_INSTALLED_BIN" != "/usr/local/bin/mttravel" ]]; then
  ln -sfn "$MTTRAVEL_INSTALLED_BIN" /usr/local/bin/mttravel
fi

echo "[3/6] 安装 TripMate 文件"
if ! id tripmate >/dev/null 2>&1; then
  useradd --system --home-dir /opt/tripmate --shell /usr/sbin/nologin tripmate
fi
install -d -o tripmate -g tripmate /opt/tripmate
install -d -o tripmate -g tripmate -m 0700 /var/lib/tripmate
install -d -o root -g root -m 0755 /usr/local/lib/tripmate
bash "$SCRIPT_DIR/install-downloads.sh"
install -o tripmate -g tripmate -m 0644 "$SCRIPT_DIR/tripmate-downloads.mjs" /opt/tripmate/tripmate-downloads.mjs
install -o tripmate -g tripmate -m 0644 "$SCRIPT_DIR/tripmate-ai-server.mjs" /opt/tripmate/tripmate-ai-server.mjs
install -o tripmate -g tripmate -m 0644 "$SCRIPT_DIR/tripmate-regions.js" /opt/tripmate/tripmate-regions.js
install -o tripmate -g tripmate -m 0644 "$SCRIPT_DIR/tripmate-mvp.html" /opt/tripmate/tripmate-mvp.html
install -o tripmate -g tripmate -m 0644 "$SCRIPT_DIR/tripmate-download.html" /opt/tripmate/tripmate-download.html
install -o tripmate -g tripmate -m 0644 "$SCRIPT_DIR/tripmate-icon.png" /opt/tripmate/tripmate-icon.png
install -o root -g root -m 0755 "$SCRIPT_DIR/set-deepseek-key.sh" /usr/local/sbin/set-tripmate-deepseek-key
install -o root -g root -m 0755 "$SCRIPT_DIR/set-tripmate-amap.sh" /usr/local/sbin/set-tripmate-amap
install -o root -g root -m 0755 "$SCRIPT_DIR/set-tripmate-meituan.sh" /usr/local/sbin/set-tripmate-meituan
install -o root -g root -m 0755 "$SCRIPT_DIR/set-tripmate-https-ip.sh" /usr/local/sbin/set-tripmate-https-ip
install -o root -g root -m 0644 "$SCRIPT_DIR/create-tripmate-admin.mjs" /usr/local/lib/tripmate/create-tripmate-admin.mjs
install -o root -g root -m 0755 "$SCRIPT_DIR/create-tripmate-admin.sh" /usr/local/sbin/create-tripmate-admin
install -o root -g root -m 0755 "$SCRIPT_DIR/set-tripmate-email.sh" /usr/local/sbin/set-tripmate-email

if [[ ! -f /etc/tripmate.env ]]; then
  umask 077
  cat > /etc/tripmate.env <<'EOF'
PORT=3000
TRIPMATE_DATA_DIR=/var/lib/tripmate
TRIPMATE_SESSION_DAYS=30
TRIPMATE_GUEST_SESSION_DAYS=7
TRIPMATE_GUEST_IP_DAILY_LIMIT=3
TRIPMATE_NEW_USER_CREDITS=10
DEEPSEEK_API_KEY=
DEEPSEEK_MODEL=deepseek-flash
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MAX_CONCURRENCY=6
HOME=/var/lib/tripmate
MEITUAN_TRAVEL_ENABLED=0
MEITUAN_TRAVEL_BIN=/usr/local/bin/mttravel
EOF
fi
chmod 600 /etc/tripmate.env
if ! grep -q '^TRIPMATE_GUEST_SESSION_DAYS=' /etc/tripmate.env; then
  printf 'TRIPMATE_GUEST_SESSION_DAYS=7\n' >> /etc/tripmate.env
fi
if ! grep -q '^TRIPMATE_GUEST_IP_DAILY_LIMIT=' /etc/tripmate.env; then
  printf 'TRIPMATE_GUEST_IP_DAILY_LIMIT=3\n' >> /etc/tripmate.env
fi
if ! grep -q '^MEITUAN_TRAVEL_ENABLED=' /etc/tripmate.env; then
  printf 'HOME=/var/lib/tripmate\nMEITUAN_TRAVEL_ENABLED=0\nMEITUAN_TRAVEL_BIN=/usr/local/bin/mttravel\n' >> /etc/tripmate.env
fi

echo "[4/6] 配置自动启动"
cat > /etc/systemd/system/tripmate.service <<'EOF'
[Unit]
Description=TripMate AI travel planner
Wants=network-online.target
After=network-online.target

[Service]
Type=simple
User=tripmate
Group=tripmate
WorkingDirectory=/opt/tripmate
EnvironmentFile=/etc/tripmate.env
ExecStart=/usr/bin/node /opt/tripmate/tripmate-ai-server.mjs
Restart=always
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true
ReadWritePaths=/var/lib/tripmate

[Install]
WantedBy=multi-user.target
EOF

echo "[5/6] 配置 Nginx"
cat > /etc/nginx/sites-available/tripmate <<'EOF'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    client_max_body_size 10m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_read_timeout 240s;
        proxy_send_timeout 240s;
    }
}
EOF
rm -f /etc/nginx/sites-enabled/default
ln -sfn /etc/nginx/sites-available/tripmate /etc/nginx/sites-enabled/tripmate
nginx -t

echo "[6/6] 启动服务"
systemctl daemon-reload
systemctl enable --now tripmate
systemctl enable --now nginx
systemctl reload nginx

echo
echo "TripMate 基础服务已安装。"
echo "配置真实酒店和餐厅地点：sudo set-tripmate-amap"
echo "配置美团官方酒旅数据：sudo set-tripmate-meituan"
echo "下一步运行：sudo set-tripmate-deepseek-key"
echo "创建管理员：sudo create-tripmate-admin"
echo "配置验证码邮箱：sudo set-tripmate-email"
echo "没有域名时启用公网 IP HTTPS：sudo set-tripmate-https-ip 公网IP 联系邮箱"
