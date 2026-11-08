# v63 Pages 国际入口验证

日期：2026-11-08。当前国际地址：https://tripmate-3x7.pages.dev 。

## 变更

- 用户自己的 Cloudflare Pages 免费账户通过直接上传发布；项目 tripmate，生产部署 78318740-2f07-4019-8aa7-bbd66c3f5330，控制台显示成功。
- URL 不再含个人用户名。主页面与国内配套页面逐字节相同，浏览器通过严格 CORS 连接国内统一业务服务。
- 国内 v63 新增精确 Pages 来源和切站地址，旧两个 Sites 来源继续兼容。未新增通配来源、账号数据库、API Token 或 GitHub 授权。
- 原 Sites 与 D1 用户记录保留不动；旧记录恢复跳回原认证区域，查询参数不透传。
- 国内服务器没有自动部署，现有用户数据、账户、订单、额度、第三方和 HTTPS 配置未修改。Android/Windows 二进制、包名与签名未修改。

## 本地检查（合成账号与本地模拟域名）

- `node tools/verify-v63-unified.mjs`：通过。真实本地 Node HTTP、独立临时账号文件、浏览器模拟 Pages/国内域名。相同账号密码、记录与额度；双向自动刷新；重新加载、退出和换号隔离；Bearer 只保存在标签页 sessionStorage；国际请求不发送 Cookie；两个旧来源兼容、恶意来源拒绝。
- 手机 390px、桌面 1280px 页面没有脚本错误或横向溢出。截图在临时目录 `tripmate-v63-0dgEtP`；已查看手机工作台截图。
- `node tools/verify-v63-pages.mjs`：通过。两个固定下载地址、Range/HEAD、拒绝其他文件和写方法、不转发认证头/Cookie、上游网络失败返回 503、旧站跳转不透传敏感查询。
- `node tools/verify-downloads.cjs`：通过。匿名下载页、HEAD、图标、账户隔离、桌面/安卓/iPhone 页面与无 JS 链接。
- Node 语法通过。所有 9 个 shell 脚本无 CRLF/BOM，并通过 Git Bash 语法检查。
- `python tools/package-server.py`：更新 ZIP 45 项、含安装文件的完整 ZIP 47 项；CRC、路径、Linux 脚本编码及两个原安装文件 SHA256 验证通过。

## 真实线上只读核验

- Cloudflare 控制台显示新项目已部署到全球；浏览器已打开新网址登录界面和 /download 页面。
- 国际 /api/health 返回 200、v63-pages-entry 和国内 primary 地址。此为前端入口健康信息，不代表国内后端在线。
- 国际 APK 路径 HEAD + Range bytes=0-1023 返回 206、Content-Length 1024、Content-Range bytes 0-1023/40748734，未跳转到带用户名的 Sites 地址。
- 国际 Windows 路径同样返回 206、Content-Length 1024、Content-Range bytes 0-1023/123905803。
- 本机连接国内 `111.230.133.155:443`：curl TLS 握手失败，Node 请求连接超时，未能确认国内当前在线版本；不能据此断言所有地区都无法访问。最后用户确认安装的是 v60。
- 国内安装 v63 后，仍需用户在实际网络用原账号验证登录和共享记录。未执行真实用户登录、AI、邮件、支付、GPS、库存或扣费验收。
- Git 暂存源码扫描 595 个文件、13060453 字节，未发现凭证、私钥、数据库或依赖/安装包误入源码。

截图：根目录 `TripMate-v63-international-live.png` 和 `TripMate-v63-international-download.png` 为真实新站公开页面；不随源码或安装包发布。
