#!/usr/bin/env bash
set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "请使用 sudo 运行：sudo set-tripmate-amap"
  exit 1
fi

echo "配置 TripMate 高德地图 Web 服务 Key。"
echo "Key 只写入服务器 /etc/tripmate.env，不会放进网页。"
IFS= read -r -s -p "高德 Web 服务 Key（输入不会显示）: " amap_key
echo
amap_key="${amap_key//$'\r'/}"

if [[ ! "$amap_key" =~ ^[A-Za-z0-9_-]{16,64}$ ]]; then
  echo "Key 格式不正确，配置未更改。请确认创建 Key 时选择的是 Web 服务。"
  exit 1
fi

check_url="https://restapi.amap.com/v5/place/text?keywords=%E9%A4%90%E5%8E%85&region=%E4%B8%8A%E6%B5%B7&city_limit=true&page_size=1&key=${amap_key}"
check_result="$(curl -fsS --max-time 15 "$check_url" || true)"
if [[ "$check_result" != *'"status":"1"'* ]]; then
  check_url="https://restapi.amap.com/v3/place/text?keywords=%E9%A4%90%E5%8E%85&city=%E4%B8%8A%E6%B5%B7&citylimit=true&offset=1&extensions=all&key=${amap_key}"
  check_result="$(curl -fsS --max-time 15 "$check_url" || true)"
fi
if [[ "$check_result" != *'"status":"1"'* ]]; then
  echo "高德接口验证失败，配置未更改。请检查 Key、服务平台和接口权限。"
  echo "返回摘要：${check_result:0:240}"
  exit 1
fi

temporary="$(mktemp)"
trap 'rm -f "$temporary"' EXIT
if [[ -f /etc/tripmate.env ]]; then
  grep -vE '^AMAP_WEB_KEY=' /etc/tripmate.env > "$temporary" || true
fi
printf 'AMAP_WEB_KEY=%s\n' "$amap_key" >> "$temporary"

install -o root -g root -m 0600 "$temporary" /etc/tripmate.env
systemctl restart tripmate
sleep 2

if systemctl is-active --quiet tripmate; then
  echo "高德地点接口已配置，TripMate 服务运行正常。"
  curl -sS -o /dev/null -w '本机页面状态：HTTP %{http_code}\n' http://127.0.0.1:3000/
else
  echo "服务启动失败，请运行：journalctl -u tripmate -n 50 --no-pager"
  exit 1
fi
