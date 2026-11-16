# v71：编辑期间不被后台同步覆盖

旧版只在发起后台读取前检查输入焦点。若读取过程中转去填写旅行偏好，较晚到达的云端更新会重新初始化页面，覆盖尚未保存的输入。

v71 在发起请求前和应用响应前都检查编辑状态。旅行偏好、订单、提醒、旅行工具和管理页，以及任何已打开的对话框，均暂缓自动读取；输入框有焦点、正在生成或页面隐藏时也暂缓。回到可安全刷新的阅读页面后，下一轮轮询会继续读取。保存和上传原有修改仍按现有流程进行，冲突处理和账号隔离保持不变。

本次只保护后台自动刷新，不新增表单自动保存，不改变用户主动载入云端或备份恢复的含义。离开未保存的表单前仍应点击保存。

## 手动安装

将更新包上传到服务器 `/home/ubuntu/` 后执行：

```bash
mkdir -p /home/ubuntu/tripmate-update-v71
cd /home/ubuntu/tripmate-update-v71
unzip -t /home/ubuntu/TripMate-server-v71-update.zip &&
unzip -o /home/ubuntu/TripMate-server-v71-update.zip -d . &&
sudo bash ./update-tripmate.sh
```

健康检查预期版本：`v71-edit-safe-refresh`。

国际入口配套包 `TripMate-pages-v71-upload.zip`，手动上传到原 Cloudflare Pages 的 `tripmate` 项目。两个入口继续共用国内账号服务，不建立新数据库。

账号、行程、订单、AI 额度及 SMTP、DeepSeek、高德、美团、HTTPS 配置均沿用。无数据库迁移，不重新打包 APK/EXE，不更换签名或应用 ID。本次未部署国内服务器或国际站；国际站到国内服务的网络超时仍需另行排查。
