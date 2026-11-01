# TripMate v40 原生 App 与公网 IP HTTPS

此版本在 v38 的全部网页功能上增加原生 iOS/Android App 所需接口，不会把网页改成 App，也不会影响现有网页用户。

## 新增能力

- 原生 App 登录和注册可取得独立会话令牌。
- App 后续请求使用 `Authorization: Bearer`，令牌保存在 iOS 钥匙串或 Android 安全存储。
- 网页仍使用原有 HttpOnly Cookie，行为不变。
- 登录设备列表会把原生端标记为 `TripMate App`。
- 实时导航允许用户拒绝系统定位后手动填写当前位置，再由高德解析地点和计算路线。
- 不增加后台定位，不在服务器保存连续定位轨迹。

## 安装

上传 `TripMate-server-v40-ip-https.zip` 后执行：

```bash
mkdir -p /home/ubuntu/tripmate-update-v40
unzip -o /home/ubuntu/TripMate-server-v40-ip-https.zip -d /home/ubuntu/tripmate-update-v40
cd /home/ubuntu/tripmate-update-v40
sudo bash update-tripmate.sh
sudo set-tripmate-https-ip 111.230.133.155 tripmate@yeah.net
```

安装完成后，原有 DeepSeek、高德、美团和邮箱配置均继续保留，无需重新填写。

## 安全要求

正式 App 必须通过 HTTPS 访问服务器。v40 可以使用域名，也可以使用 Let’s Encrypt 公网 IP 短期证书；不要让 App 通过明文 HTTP 发送邮箱、密码、会话令牌或位置。
