#!/usr/bin/env bash
# Read-only checks. Does not change firewall, certificates, data or configuration.
set -uo pipefail
echo '[1/4] 国内 HTTPS 业务状态（不发送账号或密码）'
curl --silent --show-error --include --connect-timeout 5 --max-time 10 https://111.230.133.155/api/health || true
echo
echo '[2/4] 国际站登录预检（不执行登录）'
curl --silent --show-error --include --connect-timeout 5 --max-time 10 --request OPTIONS \
  --header 'Origin: https://tripmate-3x7.pages.dev' \
  --header 'Access-Control-Request-Method: POST' \
  --header 'Access-Control-Request-Headers: content-type,x-tripmate-client,x-tripmate-platform,x-tripmate-device' \
  https://111.230.133.155/api/auth/login || true
echo
echo '[3/4] 本机 TCP 443 监听'
if command -v ss >/dev/null 2>&1; then ss -lnt '( sport = :443 )'; else echo '未找到 ss，请在控制台查看监听状态。'; fi
echo '[4/4] 本机防火墙状态'
if command -v ufw >/dev/null 2>&1; then ufw status || true; else echo '未安装 UFW；请另查云控制台防火墙。'; fi
echo '本机检查通过不代表外网一定可达；请另从用户设备打开国内 HTTPS 健康检查。'
echo '此脚本未修改任何配置；腾讯云防火墙需要在控制台另外核对。'
