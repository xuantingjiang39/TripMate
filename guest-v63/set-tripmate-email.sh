#!/usr/bin/env bash
set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "请使用 sudo 运行：sudo set-tripmate-email"
  exit 1
fi

echo "配置 TripMate 验证码发件邮箱。"
echo "QQ 邮箱服务器：smtp.qq.com；网易 163 邮箱服务器：smtp.163.com"
read -r -p "SMTP 服务器：" smtp_host
read -r -p "SMTP 端口（直接回车使用 465）：" smtp_port
smtp_port="${smtp_port:-465}"
read -r -p "发件邮箱地址：" smtp_user
read -r -s -p "邮箱 SMTP 授权码（输入不会显示，不是邮箱登录密码）：" smtp_password
echo

if [[ -z "$smtp_host" || -z "$smtp_user" || -z "$smtp_password" || ! "$smtp_port" =~ ^[0-9]+$ ]]; then
  echo "配置内容不完整，未保存。"
  exit 1
fi
if [[ "$smtp_host" == *$'\n'* || "$smtp_user" == *$'\n'* ]]; then
  echo "配置格式不正确，未保存。"
  exit 1
fi

password_b64="$(printf '%s' "$smtp_password" | base64 | tr -d '\r\n')"
temporary="$(mktemp)"
cleanup() { rm -f -- "$temporary"; }
trap cleanup EXIT
grep -vE '^SMTP_(HOST|PORT|USER|FROM|PASS|PASS_B64)=' /etc/tripmate.env > "$temporary" || true
{
  printf 'SMTP_HOST=%s\n' "$smtp_host"
  printf 'SMTP_PORT=%s\n' "$smtp_port"
  printf 'SMTP_USER=%s\n' "$smtp_user"
  printf 'SMTP_FROM=%s\n' "$smtp_user"
  printf 'SMTP_PASS_B64=%s\n' "$password_b64"
} >> "$temporary"
install -o root -g root -m 0600 "$temporary" /etc/tripmate.env
unset smtp_password password_b64
systemctl restart tripmate
sleep 2
if systemctl is-active --quiet tripmate; then
  echo "发件邮箱已保存，验证码有效期为 120 秒。"
  echo "请打开注册页面，输入收件邮箱并点击“发送验证码”测试。"
else
  echo "TripMate 服务启动失败，请运行：journalctl -u tripmate -n 50 --no-pager"
  exit 1
fi
