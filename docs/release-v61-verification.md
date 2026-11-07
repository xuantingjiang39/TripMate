# v61 核验 · 2026-11-08

## 结果
- 国内与国际主HTML逐字节一致，界面以国内当前实现为准；国际不再使用旧Agnes独立业务，而是直接使用国内统一账号/数据/额度/DeepSeek等API。
- 国际浏览器通过固定HTTPS地址、精确Origin白名单CORS和原生Bearer机制登录统一服务，Cookie不跨站发送。令牌仅存该标签页sessionStorage，不放URL或localStorage；支持刷新恢复及退出清除。
- 本地存储按统一账号隔离，国际统一前端使用新命名空间，不读取/迁移旧未分账号副本。没有删除旧国际localStorage或D1数据。
- 页面打开且无编辑/同步/生成时每15秒检查新版本，重新可见/联网也检查；版本变化才刷新，CAS与本机在途编辑保护保留。
- 国际原D1表、绑定、角色、旧账号与记录保留。日常API从独立D1退出到统一后端；旧路由明确迁至 /legacy-api，仅保留登录/读取/恢复，旧注册/AI/admin及普通sync写入关闭。旧恢复过程仍需本人证明两个账号归属，不按相同邮箱自动合并，也不复制密码、角色或累加额度。
- 国际入口是全球托管的前端，未配置独立国外业务节点。业务数据仍共用国内服务器，真实国内跨境连通待用户升级后验证。

## 安装故障根因与修复
- 实际v60 ZIP检查：install.sh的155行、update-tripmate.sh的83行是CRLF，Linux `set -euo pipefail` 被读入CR；用户用sed转换后确认服务重启HTTP200。不是网络或用户操作错误。
- v61全部9个sh为LF无UTF8 BOM；新的 tools/package-server.py 在写ZIP时规范脚本，并验证ZIP内实际字节、路径、CRC和完整安装文件SHA256。旧v60 ZIP会被该检查拒绝，新包通过。
- .gitattributes增加JS/HTML/Python的LF，已有sh LF规则保留；不再只依赖Git属性确保生成包正确。

## 已验证
- tools/verify-v61-unified.mjs：隔离真实本地Node HTTP、SQLite D1适配器、Chrome390/1280视口。两入口同一HTML；同账号/密码/记录/余额；双向自动刷新；跨站无Cookie；标签页会话/刷新/退出；账号隔离；旧副本隔离；旧D1数据未变；旧区只读业务路由；9个sh的LF/BOM和Git Bash语法检查通过。
- 本地API合成用户验证，不是生产用户登录或Cloudflare生产D1验收。网络路由模拟生产域名，未绕过真实站点的访问控制。
- 原公共下载/匿名访问/禁JS链接及桌面/Android/iPhone视口回归通过。本地真实APK/EXE完整SHA256、HEAD、Range、断点续传、取消恢复与缺失处理通过。
- v56请求异常/双账号/导出同步/冲突/额度订单保护回归，v39/v40/v42/v43静态兼容检查通过。
- 无真实账号导入/合并/删除，无SMTP邮件、支付或收费AI调用。没有自动部署腾讯云。Git Bash只做语法检查，未在Windows执行Linux安装。

## 使用依赖
国内必须升级v61，才会允许国际入口的统一API访问。国际网站发布成功只证明前端部署，不代表尚未安装的国内API已经完成跨境验收。Android v58、Windows v54安装文件不变，无需重新打包安装客户端。

Sites版本22已发布成功，源码 dd7c79c965d4c7e18bea1df05b0267185b3cbcbe，部署 appgdep_6aef566cb2b0819185edea0566d91c1f，环境修订4不变。原D1迁移/表保留；v61无新数据库迁移。国内仍由用户安装。
暂存470个文件审查无发现；新ZIP内9个sh逐个提取后通过LF/BOM和Bash语法检查。
