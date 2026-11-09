# TripMate Pages v65（待手动部署）

此目录是 v65 候选源码，没有自动上传或部署，国际线上仍为 v63。增加 JSON 请求期限和匿名连接检查，保留 v64 会话乱序保护。国际 v65 可以连接现有国内 v64；不需要再次配置密钥或迁移数据。国内页面要使用新交互需手动安装服务器 v65。下面记录现有 Pages 项目与部署方式。

已在用户自己的 Cloudflare 账户创建 `tripmate` Pages 项目，平台分配地址为 https://tripmate-3x7.pages.dev 。

`node build.mjs` 从 PROJECT 指向的配套 `guest-v65` 主页面和公共资源构建 `dist`。构建不读取用户数据库或环境配置。`dist/_worker.js` 是可直接上传的 Pages advanced-mode 模块，内嵌白名单静态资源，并转发两个固定安装文件的 GitHub 下载源。只转发 Range/If-Range，不转发 Cookie 或 Authorization。Dashboard 直接上传 ZIP 支持此模块。

通过 Cloudflare 控制台该项目的“创建新部署”上传构建后的 dist 内容 ZIP。不要上传源码目录、服务器安装包、账户数据或密钥。此次没有申请 API Token，也没有新增 GitHub OAuth 权限。

国内 Node API 需手动更新 v63 才允许此精确 Pages 来源。HTML 与国内配套主页面逐字节一致；国际 bootstrap 使用国内统一业务服务。旧站及 D1 保留在原 Sites 项目，`/legacy`、`/legacy-records` 仅跳转到原认证区域。

官方部署格式说明：https://developers.cloudflare.com/pages/get-started/direct-upload/ （Functions 小节支持 `_worker.js` 拖放上传）。
