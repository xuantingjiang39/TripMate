#!/usr/bin/env bash
set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "请使用 sudo 运行：sudo set-tripmate-deepseek-key"
  exit 1
fi

echo "配置 TripMate 的 DeepSeek API 密钥。"
echo "默认使用价格最低的 deepseek-flash，并关闭思考模式。"
IFS= read -r -s -p "DeepSeek API key（输入不会显示）: " api_key
echo
api_key="${api_key//$'\r'/}"

if [[ ! "$api_key" =~ ^sk-[A-Za-z0-9_-]+$ ]]; then
  echo "密钥格式不正确，配置未更改。"
  exit 1
fi

temporary="$(mktemp)"
trap 'rm -f "$temporary"' EXIT
if [[ -f /etc/tripmate.env ]]; then
  grep -vE '^(DEEPSEEK_(API_KEY|MODEL|BASE_URL|MAX_CONCURRENCY)|AGNES_(API_KEY|API_KEYS|RACE_WIDTH|MAX_CONCURRENCY))=' /etc/tripmate.env > "$temporary" || true
fi
{
  printf 'DEEPSEEK_API_KEY=%s\n' "$api_key"
  printf 'DEEPSEEK_MODEL=deepseek-flash\n'
  printf 'DEEPSEEK_BASE_URL=https://api.deepseek.com\n'
  printf 'DEEPSEEK_MAX_CONCURRENCY=6\n'
} >> "$temporary"

install -o root -g root -m 0600 "$temporary" /etc/tripmate.env
systemctl restart tripmate
sleep 2

if systemctl is-active --quiet tripmate; then
  echo "DeepSeek Flash 已配置，TripMate 服务运行正常。"
  curl -sS -o /dev/null -w '本机页面状态：HTTP %{http_code}\n' http://127.0.0.1:3000/
else
  echo "服务启动失败，请运行：journalctl -u tripmate -n 50 --no-pager"
  exit 1
fi
