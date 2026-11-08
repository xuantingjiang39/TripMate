#!/usr/bin/env bash
set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "请使用 sudo 运行：sudo set-tripmate-meituan"
  exit 1
fi

if ! command -v mttravel >/dev/null 2>&1; then
  echo "未检测到美团官方旅行 CLI，请先进入新版安装目录运行：sudo bash update-tripmate.sh"
  exit 1
fi

echo "配置 TripMate 美团旅行 Token。"
echo "Token 仅保存在服务器 /var/lib/tripmate/.config/meituan-travel/config.json，不会写进网页。"
IFS= read -r -s -p "美团旅行 Token（输入不会显示）: " meituan_token
echo
meituan_token="${meituan_token//$'\r'/}"

if (( ${#meituan_token} < 20 )) || [[ "$meituan_token" =~ [[:space:]] ]]; then
  echo "Token 格式不正确，配置未更改。"
  exit 1
fi

config_dir="/var/lib/tripmate/.config/meituan-travel"
temporary="$(mktemp)"
env_temporary="$(mktemp)"
error_temporary="$(mktemp)"
trap 'rm -f "$temporary" "$env_temporary" "$error_temporary"' EXIT

printf '%s' "$meituan_token" | /usr/bin/node -e '
let value="";
process.stdin.setEncoding("utf8");
process.stdin.on("data", chunk => value += chunk);
process.stdin.on("end", () => process.stdout.write(JSON.stringify({key:value}) + "\n"));
' > "$temporary"
unset meituan_token

install -d -o tripmate -g tripmate -m 0700 "$config_dir"
install -o tripmate -g tripmate -m 0600 "$temporary" "$config_dir/config.json"

if [[ -f /etc/tripmate.env ]]; then
  grep -vE '^(MEITUAN_TRAVEL_ENABLED|MEITUAN_TRAVEL_BIN|HOME)=' /etc/tripmate.env > "$env_temporary" || true
fi
printf 'HOME=/var/lib/tripmate\nMEITUAN_TRAVEL_ENABLED=1\nMEITUAN_TRAVEL_BIN=/usr/local/bin/mttravel\n' >> "$env_temporary"
install -o root -g root -m 0600 "$env_temporary" /etc/tripmate.env

echo "正在验证美团官方接口，通常需要 1～2 分钟……"
set +e
runuser -u tripmate -- env HOME=/var/lib/tripmate MEITUAN_RAW_JSON=1 timeout 130s /usr/local/bin/mttravel 北京 "北京酒店推荐" >/dev/null 2>"$error_temporary"
status=$?
set -e
if [[ "$status" -ne 0 ]]; then
  echo "Token 已安全保存，但接口验证未通过。"
  if [[ "$status" -eq 124 ]]; then
    echo "验证超时，请稍后再次运行 sudo set-tripmate-meituan。"
  else
    sed -n '1,3p' "$error_temporary" || true
  fi
  exit 1
fi

systemctl restart tripmate
sleep 2
if systemctl is-active --quiet tripmate; then
  echo "美团官方酒旅数据源已配置，TripMate 服务运行正常。"
  curl -sS -o /dev/null -w '本机页面状态：HTTP %{http_code}\n' http://127.0.0.1:3000/
else
  echo "服务启动失败，请运行：journalctl -u tripmate -n 50 --no-pager"
  exit 1
fi
