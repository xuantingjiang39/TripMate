# v63：不含个人用户名的国际入口

国际入口：https://tripmate-3x7.pages.dev
国内入口：https://111.230.133.155

Cloudflare Pages 提供国际前端和本站下载路径，账号、行程、订单与 AI 额度仍通过浏览器连接国内原业务服务。不是复制两套数据库，也不是新增独立海外业务服务器。

国内必须手动安装 v63，才能允许这个精确新来源登录，并把切站按钮指向新网址。保留两个旧 Sites 域名的精确兼容，不允许任意 pages.dev 来源。环境配置和账号数据不覆盖。

```bash
mkdir -p /home/ubuntu/tripmate-update-v63
cd /home/ubuntu/tripmate-update-v63
curl -fL --connect-timeout 15 --retry 3 -C - https://github.com/xuantingjiang39/TripMate/releases/download/v63/TripMate-server-v63-update.zip -o update.zip && unzip -o update.zip && sudo bash update-tripmate.sh
```

安装后检查 `curl -sS https://111.230.133.155/api/health` 的 version 为 `v63-pages-entry`，再去新网址用原国内账号登录。新网址有自己的浏览器会话，需首次重新登录；不复制旧域名 Cookie 或密钥。

旧独立国际数据仍在原 Sites 项目的 D1 中，没有迁移或删除。设置里的旧记录恢复入口仍指向原受认证保留区。Pages 没有账户库、D1 绑定、AI 密钥或业务 API 代理。

Android v58、Windows v54 安装文件及签名均不变，无需重新安装。国际下载经固定 GitHub Releases 源转发，国内下载仍使用服务器本地文件；都保留断点续传。免费托管有平台额度限制，不代表业务或 AI 无限制。
