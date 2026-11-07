# v62 核验 · 2026-11-08

- 原项目 appgprj_6ab509a4cee88191b6454e19cea6d795 使用 Sites change_site_slug 改为 tripmate，原生返回状态complete、新网址 https://tripmate.xuantingjiang39.chatgpt.site。没有新建站点、改变公开范围或迁移数据库。
- 两端更新国际链接、登录入口识别、站点切换、下载、旧账号恢复链接。国内CORS与记录恢复能力只精确允许新旧两个官方地址；不放开通配域名，不自动复制跨域会话。
- Node/Worker/browser JS语法、合成双账号本地HTTP/SQLite、桌面/手机浏览器：同一HTML、账号/密码/记录/余额、双向刷新、无跨站Cookie、标签页登录/退出、账号隔离、旧数据保留与旧区只读回归通过。新旧来源预检及未知来源拒绝通过。
- 新ZIP内全部9个sh为LF无BOM，Bash语法及ZIP CRC/内容验证通过。本地真实APK/EXE哈希和下载回归沿用不变的同一安装文件；无新APK，无依赖或密钥变更。
- 国内未自动部署；需要安装v62后新网址的统一登录才能访问国内API。测试为本地模拟生产域名，不代表跨境网络或真实用户登录验证。未发邮件、支付、调用收费AI或修改真实账号记录。

Sites版本23发布成功：源码5326a2e9b60f68a53640eb6edae30a92fd986288，部署appgdep_6aefb8ac776c81919bea5916687cfd8b，新网址原生返回一致，环境修订4保持。暂存543个文件审查无发现。
