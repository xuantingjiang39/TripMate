# v67：备份恢复版本保护

旧版会直接恢复备份：如果自动下载恢复前备份后，另一设备又更新云端，这次更新可能被覆盖。v67 的导出接口同时返回快照版本和恢复版本校验能力，网页将该版本作为恢复条件；服务在账户写入事务内核对，版本不一致返回 409，不执行覆盖。

旧备份文件仍然支持，密码、登录设备、账号角色和 AI 额度不会从备份恢复。请求必须携带有效版本；旧网页或脚本的无版本恢复请求返回 428，需要刷新到新网页。原 Android App 未调用此恢复接口，普通登录/同步不变。

取消或改选文件、恢复前出现本机新修改会停止提交；若恢复已在云端完成，而本机又有新修改，会保留本机并暂停同步供处理。恢复回执丢失时不会宣称数据未变化，会提示刷新核对，不自动重新提交。退出/换号会清空旧文件预览，旧回调不能修改新账号的恢复状态。

## 国内服务器更新

把 `TripMate-server-v67-update.zip` 上传到 `/home/ubuntu/`，执行：

```bash
mkdir -p /home/ubuntu/tripmate-update-v67
cd /home/ubuntu/tripmate-update-v67
unzip -t /home/ubuntu/TripMate-server-v67-update.zip && unzip -o /home/ubuntu/TripMate-server-v67-update.zip -d . && sudo bash ./update-tripmate.sh
```

更新后 `/api/health` 版本为 `v67-restore-conflicts`。账号、行程、订单、AI 额度、SMTP/DeepSeek/高德/美团及 HTTPS 配置保留；不用重新填写授权码。

## 国际站更新

在现有 Cloudflare Pages `tripmate` 项目创建 Production 部署，上传 `TripMate-pages-v67-upload.zip`。网址不变，不新建数据库或 API Token。

普通登录和同步仍兼容国内 v64；安全恢复需要国内 v67。国际新网页在旧服务上会明确提示所需能力缺失，并在发送恢复请求前停止。建议先更新国内服务器，再更新国际前端。旧备份文件可继续选择，不需要修改文件中的版本字段。

未自动部署任何站点。国内最新用户确认 v64，国际只读检查仍为 v63，公网访问问题尚未确认根因。Android v58、Windows v54 安装文件、签名和用户目录不变。
