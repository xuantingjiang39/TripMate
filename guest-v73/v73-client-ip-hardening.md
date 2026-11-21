# v73 客户端来源识别加固

## 改了什么

服务器不再把访问者可自行填写的 `X-Forwarded-For` 当作真实来源。只有请求的 TCP 对端是本机 Nginx 时，才读取 Nginx 覆盖写入并经 IP 格式校验的 `X-Real-IP`；直连或代理头无效时，使用 TCP 对端地址。

这会让登录失败限制、游客每日体验次数限制和登录设备记录使用可信来源地址。账号、行程、订单、AI 额度、SMTP、DeepSeek、高德及美团配置均不迁移、不重置。

## 服务器手动更新

下载 `TripMate-server-v73-update.zip` 后上传到服务器 `/home/ubuntu/`，再执行：

```bash
mkdir -p /home/ubuntu/tripmate-update-v73
cd /home/ubuntu/tripmate-update-v73
unzip -t /home/ubuntu/TripMate-server-v73-update.zip && \
unzip -o /home/ubuntu/TripMate-server-v73-update.zip -d . && \
sudo bash ./update-tripmate.sh
```

更新完成后可检查 `curl -sS https://服务器地址/api/health`，预期版本为 `v73-client-ip-hardening`。本更新不改网页、国际站、Android 或 Windows 安装包；没有自动部署。
