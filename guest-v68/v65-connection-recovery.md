# v65：登录超时与连接检查

国内服务已由用户提供的 `/api/health` 确认为 v64，国际连接失败不能据此认定需要升级。v65 给登录请求和响应正文设置共同的 12 秒期限，并在超时后恢复按钮操作；网络失败后可以展开“无法登录？检查连接”。

检查按钮只读取实际国内业务 `/api/health`，不发送 Cookie、Authorization、账号、密码或行程。最多等待 8 秒；显示可验证的服务版本、HTTP 状态或网络错误。只有接口实际返回已知旧版本时才提示升级，不把 Pages 前端健康信息当作业务服务健康。

## 国内页面更新

```bash
mkdir -p /home/ubuntu/tripmate-update-v65
cd /home/ubuntu/tripmate-update-v65
curl -fL --connect-timeout 15 --retry 3 -C - https://github.com/xuantingjiang39/TripMate/releases/download/v65/TripMate-server-v65-update.zip -o update.zip && unzip -o update.zip && sudo bash update-tripmate.sh
```

如果 GitHub 下载再次 504，可把电脑上的 `TripMate-server-v65-update.zip` 上传到 `/home/ubuntu/` 后执行：

```bash
cd /home/ubuntu/tripmate-update-v65
unzip -t /home/ubuntu/TripMate-server-v65-update.zip && unzip -o /home/ubuntu/TripMate-server-v65-update.zip -d . && sudo bash ./update-tripmate.sh
```

更新后 `/api/health` 的版本为 `v65-connection-recovery`。账号、行程、订单、额度、SMTP/DeepSeek/高德/美团及 HTTPS 配置保留。Android v58、Windows v54 安装文件不变。

## 国际页面更新

在现有 Cloudflare Pages 项目 tripmate 创建 Production 部署，上传 `TripMate-pages-v65-upload.zip`。网址不变，不创建新数据库或 API Token。国际 v65 兼容现有国内 v64，无需再次设置第三方配置；两站前端要同时使用本次改进则分别更新。

## 只读排查

在解压目录运行 `sudo bash ./diagnose-tripmate-connection.sh`，查看国内 HTTPS、精确国际来源的登录预检、443 监听和 UFW 状态。脚本不登录、不发邮件、不扣费、不修改防火墙或证书。服务器自身检查成功仍不能证明用户网络可以访问公网 443，需要从用户浏览器另外打开健康检查。

本次不自动部署；尚未收到上一轮云防火墙/跨域诊断结果，公网连接根因仍未确认。浏览器超时不会撤销服务器上可能已经完成的操作，先检查连接，避免连续提交。连接模块不自动重试。AI 流式生成请求不应用 12 秒登录期限，保留原生成策略。
