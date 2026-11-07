# TripMate v41：安卓连接修复

本版本修复部分 Android 手机无法连接公网 IP HTTPS 的问题：

- 公网 IP 证书改为兼容面更广的 RSA 2048 位密钥。
- 保留 Let's Encrypt 短期证书自动续期。
- 续期后自动重载 Nginx。
- 新增 `/api/health`，供 App 判断 HTTPS、服务器版本和接口状态。
- 更新过程不会删除账号、行程、AI 额度或邮箱、DeepSeek、高德、美团配置。

安装服务端后必须重新执行一次证书配置：

```bash
sudo set-tripmate-https-ip 111.230.133.155 tripmate@yeah.net
```

完成时应看到 `RSA key ok` 和 `HTTPS 页面验证成功`。
