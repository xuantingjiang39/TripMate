# v70：云端响应不完整时保留本机记录

旧网页若收到带版本号但缺少 `state` 的同步响应，会把它当作空记录，可能清空本机草稿、订单等内容；部分路径也可能接受错误类型或较旧版本。

v70 在登录载入、后台同步和“保留本机副本并载入云端”前统一校验：必须明确包含旅行数据对象和非负安全整数版本，且已知数据容器结构正确。后台/手动切换还会拒绝低于当前已知版本的结果。异常时不写本机旅行数据、不更新同步基准、不清掉未同步标记，也不自动上传空记录；背景同步会显示保留本机内容的提示。

明确返回的有效空对象仍是合法记录，按原规则载入。本次不是禁止删除，也不会回填本机数据覆盖有效云端记录。不自动修复或清理已有异常数据。

## 手动安装

将 `TripMate-server-v70-update.zip` 上传到服务器 `/home/ubuntu/`：

```bash
mkdir -p /home/ubuntu/tripmate-update-v70
cd /home/ubuntu/tripmate-update-v70
unzip -t /home/ubuntu/TripMate-server-v70-update.zip &&
unzip -o /home/ubuntu/TripMate-server-v70-update.zip -d . &&
sudo bash ./update-tripmate.sh
```

健康检查预期版本为 `v70-snapshot-reads`：

```bash
curl -sS https://111.230.133.155/api/health
```

国际站配套 `TripMate-pages-v70-upload.zip` 手动上传到已有 Cloudflare Pages 的 `tripmate` 项目。仍使用原国内统一账号与数据服务，不建立第二套账号库，也不解决尚未确认原因的公网连接问题。

此次更新网页读取保护；APK、EXE 未重新打包。现有账号、行程、订单、AI 额度、SMTP、DeepSeek、高德、美团及 HTTPS 配置保持不变，无数据库迁移。没有自动部署国内服务器或国际站。
