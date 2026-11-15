# TripMate v40：无域名 HTTPS

Let’s Encrypt 现在可以给公网 IPv4 签发受操作系统信任的短期证书，因此 TripMate App 不再必须等待域名。

## 使用方法

1. 先在腾讯云安全组放行 TCP 80 和 443。
2. 升级 v40 后运行：

```bash
sudo set-tripmate-https-ip 111.230.133.155 tripmate@yeah.net
```

3. 看到“HTTPS 页面验证成功”后，浏览器打开 `https://111.230.133.155`。

## 安全设计

- 证书约 6 天有效，系统每 8 小时检查一次续期。
- 续期使用 webroot 验证，不需要停止 TripMate 或 Nginx。
- 原 Nginx 配置会带时间戳备份；如果新配置检查失败，脚本自动恢复。
- HTTP 请求会固定跳转到该公网 IP 的 HTTPS，防止 Host 头注入导致开放重定向。

## 检查自动续期

```bash
systemctl status tripmate-certbot-renew.timer --no-pager
sudo certbot certificates --cert-name tripmate-ip
```

如果申请失败，先检查腾讯云安全组、Ubuntu 防火墙以及公网 IP 是否为当前服务器的固定 IP。
