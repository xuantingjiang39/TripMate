# v64：退出与换号保护

修复经过延迟响应复现的会话问题：旧退出响应会删除较新的国际登录令牌，旧界面回调也会重置新账号。现在国际网页开始退出时立即清除本标签页令牌，并将原令牌仅用于向服务器撤销会话。旧登录、旧账号接口响应无法更新后续会话。

国内与国际网页的通用 JSON 接口在读取响应体后再次核对当前账号/游客对象，防止换号期间旧账号的额度明细等数据落到新账号界面。用户数据不会删除。

## 国内服务器手动更新

```bash
mkdir -p /home/ubuntu/tripmate-update-v64
cd /home/ubuntu/tripmate-update-v64
curl -fL --connect-timeout 15 --retry 3 -C - https://github.com/xuantingjiang39/TripMate/releases/download/v64/TripMate-server-v64-update.zip -o update.zip && unzip -o update.zip && sudo bash update-tripmate.sh
```

检查 `curl -sS https://111.230.133.155/api/health` 返回的 version 为 `v64-session-races`。本机完整包为 `TripMate-server-v64-session-races.zip`，包含原 Android v58/Windows v54 安装文件，适合不希望服务器再从 GitHub 下载大文件时使用。

## 国际站手动更新

下载同一 Release 中的 `TripMate-pages-v64-upload.zip`，在自己的 Cloudflare 控制台 Workers 和 Pages → tripmate → 创建部署 → Production 上传此 ZIP。网址仍为 https://tripmate-3x7.pages.dev ，不需要迁移数据库、重新创建项目或填写 API Token。不要把服务器更新 ZIP 当成 Pages 部署包上传。

国际线上没有自动更新，仍是 v63。Pages 仅提供前端与固定来源下载，业务数据仍在国内。国内接口、原 Sites 的旧记录保留区、邮箱/DeepSeek/高德/美团/HTTPS 配置及移动端签名均不变。

断网退出只保证本标签页不再保留令牌；服务器撤销若未送达，仍依服务器原会话有效期处理，不能宣称已经退出所有设备。未执行真实账号、收费 AI、支付或邮件验收。
