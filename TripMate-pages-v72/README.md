# TripMate Pages v72（待手动部署）

v72 新增定位生命周期保护：停止时清除 GPS 监听、取消浏览器请求与待执行跳转，已排队的旧回调和结果失效。切换日期、路线或账号后需重新开始定位。首次进入明确选择第 1 天。保留此前的编辑期间刷新、快照完整性与备份恢复保护。建议国内与国际主页面同步手动安装。没有数据库迁移，不重新配置密钥，也不解决尚未排查完的公网连接超时。

已在用户自己的 Cloudflare 账户创建 `tripmate` Pages 项目，平台分配地址为 https://tripmate-3x7.pages.dev 。

`node build.mjs` 从 PROJECT 指向的配套 `guest-v72` 主页面和公共资源构建 `dist`。构建不读取用户数据库或环境配置。`dist/_worker.js` 是可直接上传的 Pages advanced-mode 模块，内嵌白名单静态资源，并转发两个固定安装文件的 GitHub 下载源。只转发 Range/If-Range，不转发 Cookie 或 Authorization。Dashboard 直接上传 ZIP 支持此模块。

通过 Cloudflare 控制台该项目的“创建新部署”上传构建后的 dist 内容 ZIP。不要上传源码目录、服务器安装包、账户数据或密钥。此次没有申请 API Token，也没有新增 GitHub OAuth 权限。

国内 Node API 需手动更新 v63 才允许此精确 Pages 来源。HTML 与国内配套主页面逐字节一致；国际 bootstrap 使用国内统一业务服务。旧站及 D1 保留在原 Sites 项目，`/legacy`、`/legacy-records` 仅跳转到原认证区域。

官方部署格式说明：https://developers.cloudflare.com/pages/get-started/direct-upload/ （Functions 小节支持 `_worker.js` 拖放上传）。


2026-11-16：v72 仅已准备待手动部署。PROJECT 中保留实际 v70 部署记录。定位保护说明见 guest-v72/v72-navigation-lifecycle.md。
