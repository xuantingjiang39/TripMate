# v68：损坏备份不再写入旅行记录

旧版本只检查备份外层是对象。例如订单列表中的一条记录被损坏为 `null`，恢复接口仍然接受；刷新后，订单渲染会抛出异常，影响整个工作台初始化。

v68 在本机选择备份时、服务器恢复接口和同步写入接口使用同一份结构检查。订单、收藏、提醒、支出、行李列表，以及行程中的日期、事件、交通、推荐和费用明细等已知容器格式异常时，显示问题位置，拒绝整次写入；不会过滤掉坏项后悄悄保存剩余内容。

保留旧版金额格式、空的可选区段、原生安卓的旧行程格式、历史扩展字段和未知的旧收藏元数据。提醒未填日期/时间时，排序仍可运行。检查不修改原文件，也不自动修复或清空已有云端/本机记录。

这是结构保护，不是酒店真实性、价格、库存或行程合理性验证；已经存在的异常记录仍需单独检查，不能把本次发布当作历史数据修复。原 v67 的恢复版本条件、离线日志、并发保护、额度和会话隔离均保留。

## 安装

下载 `TripMate-server-v68-update.zip`，上传到服务器 `/home/ubuntu/` 后执行：

```bash
mkdir -p /home/ubuntu/tripmate-update-v68
cd /home/ubuntu/tripmate-update-v68
unzip -t /home/ubuntu/TripMate-server-v68-update.zip &&
unzip -o /home/ubuntu/TripMate-server-v68-update.zip -d . &&
sudo bash ./update-tripmate.sh
```

更新不重置账号、行程、订单、AI 额度、SMTP、DeepSeek、高德、美团或 HTTPS 配置。APK、Windows 安装文件、签名和用户目录未变，无需重新安装 App 来更新服务器检查。

服务器健康检查预期版本为 `v68-backup-validation`：

```bash
curl -sS https://111.230.133.155/api/health
```

国际网页配套包为 `TripMate-pages-v68-upload.zip`，手动上传到已有 Cloudflare Pages 的 `tripmate` 项目生产部署。两端部署 v68 后，恢复预览和业务写入都具有同样的检查。国际网页仍访问原国内数据服务，本包不会建立第二套账号库，也不会解决尚未查明的公网连接问题。

本次没有自动部署国内服务器或国际站。最近用户确认国内 v64，国际最近确认 v63；不能以本机测试推断线上已更新。
