# v66：未同步修改恢复保护

已复现旧版问题：断网修改行程且保存未成功后，刷新会将本机修改替换为云端旧稿。v66 在本机写入前持久记录同步基准版本，按账号和入口隔离。刷新时先核对版本，不直接用云端覆盖带有未同步标记的内容。

- 云端版本未变：恢复本机内容并继续原版本校验同步。
- 提交已到服务器但回执丢失：如果两边内容一致，视为已同步，不重复提交。
- 云端也被其他设备修改：本机和云端均保留，暂停同步，提示处理冲突。
- 可在账号菜单选择“保留本机副本并载入云端”。只有本机副本存储成功才切换，已有副本不自动删除；每份可下载为现有备份格式，并通过“从备份恢复旅行数据”恢复。

本机副本属于当前浏览器、入口和账号，不是新的云端备份服务。清除站点数据会影响本机副本，重要内容请下载文件。删除账号的本人确认操作会清理当前入口该账号的待同步标记和恢复副本。未同步修改未处理前暂停导入备份，避免覆盖它们。

## 国内服务器

把 `TripMate-server-v66-update.zip` 上传到 `/home/ubuntu/`，执行：

```bash
mkdir -p /home/ubuntu/tripmate-update-v66
cd /home/ubuntu/tripmate-update-v66
unzip -t /home/ubuntu/TripMate-server-v66-update.zip && unzip -o /home/ubuntu/TripMate-server-v66-update.zip -d . && sudo bash ./update-tripmate.sh
```

更新后 `/api/health` 版本为 `v66-pending-recovery`。需要 GitHub 直接下载时，地址是本项目 Releases 的 `/download/v66/TripMate-server-v66-update.zip`；如遇 504，使用上述本机上传方式。

## 国际站

在现有 Cloudflare Pages `tripmate` 项目新建 Production 部署，上传 `TripMate-pages-v66-upload.zip`。不新建数据库，不填写新密钥，网址不变。国际前端 v66 可连接国内 v64；国内网页和 Windows 在线工作台要使用本次保护需安装服务器 v66。

没有自动部署站点。国内最新用户确认版本仍是 v64，国际检查仍为 v63；公网访问问题未确认根因，本次不宣称已经解决。Android v58、Windows v54 安装文件、签名与数据目录未改。
