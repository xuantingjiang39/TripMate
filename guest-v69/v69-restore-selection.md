# v69：恢复备份只采用最新选择

连续选择两个备份文件时，旧文件读取较慢可能晚于新文件完成。旧版会把已显示的新预览替换成旧文件，或者用旧文件的读取/解析错误清空新预览；读取期间退出、切换账号也可能留下旧状态提示。

v69 为每次选择记录代次和当前账号对象。清空预览、取消、换号会让之前的读取失效；读取成功或失败均先核对归属，只允许当前选择修改界面。不会自动提交恢复，也不会更改任何备份文件。原来的结构、邮箱和云端版本检查继续生效。

## 手动安装

把 `TripMate-server-v69-update.zip` 上传到服务器 `/home/ubuntu/`：

```bash
mkdir -p /home/ubuntu/tripmate-update-v69
cd /home/ubuntu/tripmate-update-v69
unzip -t /home/ubuntu/TripMate-server-v69-update.zip &&
unzip -o /home/ubuntu/TripMate-server-v69-update.zip -d . &&
sudo bash ./update-tripmate.sh
```

健康检查预期版本为 `v69-restore-selection`：

```bash
curl -sS https://111.230.133.155/api/health
```

国际站配套 `TripMate-pages-v69-upload.zip` 手动上传到已有 Cloudflare Pages 的 `tripmate` 项目。两站仍使用原国内统一数据服务，本更新不建立第二套账号，也不解决未确认原因的公网连接问题。

没有自动部署、数据库迁移或配置重置。保留账号、行程、订单、AI 额度、SMTP、DeepSeek、高德、美团和 HTTPS 配置；APK、EXE、签名、应用目录和工具链未变。此次改善网页恢复流程，安卓原生 App 没有重新打包。已有历史异常数据不自动删除或修复。
