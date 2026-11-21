#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "请使用 sudo 运行：sudo set-tripmate-https-ip 公网IP 联系邮箱"
  exit 1
fi

PUBLIC_IP="${1:-}"
CONTACT_EMAIL="${2:-}"

if [[ -z "$PUBLIC_IP" ]]; then
  read -r -p "TripMate 公网 IPv4 地址：" PUBLIC_IP
fi
if [[ -z "$CONTACT_EMAIL" ]]; then
  read -r -p "证书到期通知邮箱：" CONTACT_EMAIL
fi

python3 - "$PUBLIC_IP" <<'PY'
import ipaddress
import sys

value = sys.argv[1]
try:
    address = ipaddress.ip_address(value)
except ValueError:
    raise SystemExit("公网 IP 格式不正确。")
if address.version != 4 or not address.is_global:
    raise SystemExit("目前脚本只接受可从互联网访问的公网 IPv4 地址。")
PY

if [[ ! "$CONTACT_EMAIL" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]]; then
  echo "联系邮箱格式不正确。"
  exit 1
fi

if [[ ! -f /etc/nginx/sites-available/tripmate ]]; then
  echo "未找到 TripMate 的 Nginx 配置，请先安装 TripMate。"
  exit 1
fi

echo "[1/6] 准备最新版 Certbot"
if ! command -v snap >/dev/null 2>&1; then
  apt-get update
  apt-get install -y snapd
fi
systemctl enable --now snapd.socket >/dev/null 2>&1 || true
snap install core >/dev/null 2>&1 || snap refresh core >/dev/null
if snap list certbot >/dev/null 2>&1; then
  snap refresh certbot >/dev/null
else
  snap install --classic certbot >/dev/null
fi
ln -sfn /snap/bin/certbot /usr/local/bin/certbot
CERTBOT=/usr/local/bin/certbot

CERTBOT_VERSION="$($CERTBOT --version 2>&1 | awk '{print $2}')"
python3 - "$CERTBOT_VERSION" <<'PY'
import re
import sys

match = re.match(r"^(\d+)\.(\d+)", sys.argv[1])
if not match or (int(match.group(1)), int(match.group(2))) < (5, 4):
    raise SystemExit("需要 Certbot 5.4 或更高版本，当前版本：" + sys.argv[1])
PY

echo "[2/6] 配置不间断的 HTTP 验证目录"
install -d -o www-data -g www-data -m 0755 /var/www/certbot/.well-known/acme-challenge
BACKUP="/etc/nginx/sites-available/tripmate.before-ip-https.$(date +%Y%m%d%H%M%S)"
cp -a /etc/nginx/sites-available/tripmate "$BACKUP"

cat > /etc/nginx/sites-available/tripmate <<EOF
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/certbot;
        default_type text/plain;
        try_files \$uri =404;
    }

    client_max_body_size 10m;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_buffering off;
        proxy_read_timeout 240s;
        proxy_send_timeout 240s;
    }
}
EOF

if ! nginx -t; then
  cp -a "$BACKUP" /etc/nginx/sites-available/tripmate
  nginx -t
  systemctl reload nginx
  echo "Nginx 验证配置失败，已恢复原配置：$BACKUP"
  exit 1
fi
systemctl reload nginx

echo "[3/6] 申请兼容旧版 Android 的 RSA 公网 IP HTTPS 证书"
if [[ ! -s /etc/letsencrypt/live/tripmate-ip-rsa/fullchain.pem ]]; then
  if ! $CERTBOT certonly \
    --non-interactive \
    --agree-tos \
    --email "$CONTACT_EMAIL" \
    --preferred-profile shortlived \
    --key-type rsa \
    --rsa-key-size 2048 \
    --preferred-chain "ISRG Root X1" \
    --webroot \
    --webroot-path /var/www/certbot \
    --ip-address "$PUBLIC_IP" \
    --cert-name tripmate-ip-rsa \
    --deploy-hook "systemctl reload nginx"; then
    cp -a "$BACKUP" /etc/nginx/sites-available/tripmate
    nginx -t
    systemctl reload nginx
    echo "证书申请失败，已恢复原配置。请确认腾讯云安全组已开放 TCP 80 和 443。"
    exit 1
  fi
else
  echo "检测到已有 tripmate-ip-rsa 证书，保留并继续配置。"
fi

if ! openssl rsa -in /etc/letsencrypt/live/tripmate-ip-rsa/privkey.pem -check -noout >/dev/null 2>&1; then
  echo "新证书不是预期的 RSA 密钥，拒绝替换当前 HTTPS 配置。"
  cp -a "$BACKUP" /etc/nginx/sites-available/tripmate
  nginx -t
  systemctl reload nginx
  exit 1
fi

echo "[4/6] 启用 HTTPS，并把 HTTP 固定跳转到该公网 IP"
cat > /etc/nginx/sites-available/tripmate <<EOF
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/certbot;
        default_type text/plain;
        try_files \$uri =404;
    }

    location / {
        return 308 https://$PUBLIC_IP\$request_uri;
    }
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name $PUBLIC_IP;

    ssl_certificate /etc/letsencrypt/live/tripmate-ip-rsa/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tripmate-ip-rsa/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_session_cache shared:TripMateTLS:10m;
    ssl_session_timeout 1d;
    add_header Strict-Transport-Security "max-age=86400" always;

    client_max_body_size 10m;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_buffering off;
        proxy_read_timeout 240s;
        proxy_send_timeout 240s;
    }
}
EOF

if ! nginx -t; then
  cp -a "$BACKUP" /etc/nginx/sites-available/tripmate
  nginx -t
  systemctl reload nginx
  echo "HTTPS 配置验证失败，已恢复原配置：$BACKUP"
  exit 1
fi
systemctl reload nginx

echo "[5/6] 配置短期证书自动续期"
cat > /etc/systemd/system/tripmate-certbot-renew.service <<'EOF'
[Unit]
Description=Renew TripMate public IP HTTPS certificate
After=network-online.target nginx.service
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=/usr/local/bin/certbot renew --quiet --cert-name tripmate-ip-rsa --deploy-hook "systemctl reload nginx"
EOF

cat > /etc/systemd/system/tripmate-certbot-renew.timer <<'EOF'
[Unit]
Description=Check TripMate public IP certificate every 8 hours

[Timer]
OnBootSec=10min
OnUnitActiveSec=8h
RandomizedDelaySec=20min
Persistent=true

[Install]
WantedBy=timers.target
EOF

systemctl daemon-reload
systemctl enable --now tripmate-certbot-renew.timer

echo "[6/6] 验证证书和服务"
openssl x509 -in /etc/letsencrypt/live/tripmate-ip-rsa/fullchain.pem -noout -subject -issuer -enddate
openssl rsa -in /etc/letsencrypt/live/tripmate-ip-rsa/privkey.pem -check -noout
if curl --fail --silent --show-error --max-time 15 "https://$PUBLIC_IP/" >/dev/null; then
  echo "HTTPS 页面验证成功。"
else
  echo "证书已配置，但本机回环访问未成功。请检查腾讯云安全组是否开放 TCP 443。"
fi

echo
echo "TripMate 已启用：https://$PUBLIC_IP"
echo "自动续期状态：systemctl status tripmate-certbot-renew.timer --no-pager"
echo "原 Nginx 配置备份：$BACKUP"
