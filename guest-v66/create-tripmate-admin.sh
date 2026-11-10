#!/usr/bin/env bash
set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "请使用 sudo 运行：sudo create-tripmate-admin"
  exit 1
fi

read -r -p "管理员邮箱：" admin_email
read -r -p "管理员昵称：" admin_name
read -r -s -p "管理员密码（至少 8 位，输入不会显示）：" admin_password
echo
read -r -s -p "再次输入密码：" admin_password_confirm
echo
if [[ "$admin_password" != "$admin_password_confirm" ]]; then
  echo "两次密码不一致，未创建账号。"
  exit 1
fi

data_directory="$(awk -F= '$1 == "TRIPMATE_DATA_DIR" { print substr($0, index($0, "=") + 1); exit }' /etc/tripmate.env 2>/dev/null || true)"
data_directory="${data_directory:-/var/lib/tripmate}"
systemctl stop tripmate
restart_service() { systemctl start tripmate >/dev/null 2>&1 || true; }
trap restart_service EXIT
printf '%s\n%s\n%s\n' "$admin_email" "$admin_name" "$admin_password" | TRIPMATE_DATA_DIR="$data_directory" node /usr/local/lib/tripmate/create-tripmate-admin.mjs
unset admin_password admin_password_confirm
chown -R tripmate:tripmate "$data_directory"
chmod 700 "$data_directory"
chmod 600 "$data_directory/accounts.json"
systemctl start tripmate
trap - EXIT
echo "现在可以用这个邮箱和密码登录 TripMate 管理员后台。"
