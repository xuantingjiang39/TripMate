#!/usr/bin/env bash
set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "请使用 root 用户运行：bash update-tripmate.sh"
  exit 1
fi

if [[ ! -d /opt/tripmate ]] || [[ ! -f /etc/systemd/system/tripmate.service ]]; then
  echo "尚未检测到已安装的 TripMate，请先运行 bash install.sh"
  exit 1
fi

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
for required in tripmate-regions.js tripmate-ai-server.mjs tripmate-downloads.mjs tripmate-mvp.html tripmate-download.html tripmate-icon.png install-downloads.sh downloads-SHA256SUMS.txt; do
  [[ -s "$SCRIPT_DIR/$required" ]] || { echo "安装包不完整，缺少 $required；未更新服务。"; exit 1; }
done
node --check "$SCRIPT_DIR/tripmate-ai-server.mjs"
node --check "$SCRIPT_DIR/tripmate-downloads.mjs"
bash "$SCRIPT_DIR/install-downloads.sh" --check
npm install -g @meituan-travel/travel-cli@1.0.16
MTTRAVEL_INSTALLED_BIN="$(command -v mttravel)"
if [[ "$MTTRAVEL_INSTALLED_BIN" != "/usr/local/bin/mttravel" ]]; then
  ln -sfn "$MTTRAVEL_INSTALLED_BIN" /usr/local/bin/mttravel
fi
install -d -o tripmate -g tripmate -m 0700 /var/lib/tripmate
install -d -o root -g root -m 0755 /usr/local/lib/tripmate
bash "$SCRIPT_DIR/install-downloads.sh"
install -o tripmate -g tripmate -m 0644 "$SCRIPT_DIR/tripmate-downloads.mjs" /opt/tripmate/tripmate-downloads.mjs
install -o tripmate -g tripmate -m 0644 "$SCRIPT_DIR/tripmate-ai-server.mjs" /opt/tripmate/tripmate-ai-server.mjs
install -o tripmate -g tripmate -m 0644 "$SCRIPT_DIR/tripmate-regions.js" /opt/tripmate/tripmate-regions.js
install -o tripmate -g tripmate -m 0644 "$SCRIPT_DIR/tripmate-mvp.html" /opt/tripmate/tripmate-mvp.html
install -o tripmate -g tripmate -m 0644 "$SCRIPT_DIR/tripmate-download.html" /opt/tripmate/tripmate-download.html
install -o tripmate -g tripmate -m 0644 "$SCRIPT_DIR/tripmate-icon.png" /opt/tripmate/tripmate-icon.png
install -o root -g root -m 0644 "$SCRIPT_DIR/create-tripmate-admin.mjs" /usr/local/lib/tripmate/create-tripmate-admin.mjs
install -o root -g root -m 0755 "$SCRIPT_DIR/create-tripmate-admin.sh" /usr/local/sbin/create-tripmate-admin
install -o root -g root -m 0755 "$SCRIPT_DIR/set-tripmate-email.sh" /usr/local/sbin/set-tripmate-email
install -o root -g root -m 0755 "$SCRIPT_DIR/set-deepseek-key.sh" /usr/local/sbin/set-tripmate-deepseek-key
install -o root -g root -m 0755 "$SCRIPT_DIR/set-tripmate-amap.sh" /usr/local/sbin/set-tripmate-amap
install -o root -g root -m 0755 "$SCRIPT_DIR/set-tripmate-meituan.sh" /usr/local/sbin/set-tripmate-meituan
install -o root -g root -m 0755 "$SCRIPT_DIR/set-tripmate-https-ip.sh" /usr/local/sbin/set-tripmate-https-ip

if ! grep -q '^TRIPMATE_DATA_DIR=' /etc/tripmate.env; then
  printf '\nTRIPMATE_DATA_DIR=/var/lib/tripmate\nTRIPMATE_SESSION_DAYS=30\n' >> /etc/tripmate.env
fi
if ! grep -q '^TRIPMATE_NEW_USER_CREDITS=' /etc/tripmate.env; then
  printf 'TRIPMATE_NEW_USER_CREDITS=10\n' >> /etc/tripmate.env
fi
if ! grep -q '^TRIPMATE_GUEST_SESSION_DAYS=' /etc/tripmate.env; then
  printf 'TRIPMATE_GUEST_SESSION_DAYS=7\n' >> /etc/tripmate.env
fi
if ! grep -q '^TRIPMATE_GUEST_IP_DAILY_LIMIT=' /etc/tripmate.env; then
  printf 'TRIPMATE_GUEST_IP_DAILY_LIMIT=3\n' >> /etc/tripmate.env
fi
if ! grep -q '^DEEPSEEK_MODEL=' /etc/tripmate.env; then
  printf 'DEEPSEEK_MODEL=deepseek-flash\nDEEPSEEK_BASE_URL=https://api.deepseek.com\nDEEPSEEK_MAX_CONCURRENCY=6\n' >> /etc/tripmate.env
fi
if ! grep -q '^MEITUAN_TRAVEL_ENABLED=' /etc/tripmate.env; then
  printf 'HOME=/var/lib/tripmate\nMEITUAN_TRAVEL_ENABLED=0\nMEITUAN_TRAVEL_BIN=/usr/local/bin/mttravel\n' >> /etc/tripmate.env
fi

systemctl restart tripmate
nginx -t
systemctl reload nginx
sleep 2

if systemctl is-active --quiet tripmate; then
  echo "TripMate 已更新并重新启动。"
  echo "软件下载入口：网站地址/download（未登录也能访问）"
  curl -sS -o /dev/null -w '本机页面状态：HTTP %{http_code}\n' http://127.0.0.1:3000/
  echo "如未创建管理员，请运行：sudo create-tripmate-admin"
  echo "配置注册验证码邮箱：sudo set-tripmate-email"
  echo "配置最便宜的 DeepSeek Flash：sudo set-tripmate-deepseek-key"
  echo "配置真实酒店和餐厅地点：sudo set-tripmate-amap"
  echo "配置美团官方酒旅数据：sudo set-tripmate-meituan"
  echo "修复 Android 连接并启用 RSA 公网 IP HTTPS：sudo set-tripmate-https-ip 公网IP 联系邮箱"
else
  echo "更新后服务未正常启动，请运行：journalctl -u tripmate -n 50 --no-pager"
  exit 1
fi
