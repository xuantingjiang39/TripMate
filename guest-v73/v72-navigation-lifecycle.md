# v72：停止后不再继续导航

旧网页点击“停止导航”后，排队中的 GPS 回调仍可能发起新的路线查询；已发出的请求返回后也会重画旧路线。手机端 180ms 延迟自动跳转没有取消保护，可能在停止后仍打开地图。首次进入导航页还可能出现空白的日期选项，实际却使用第 1 天。

v72 为每次定位建立独立会话，校验账号与所选路线。停止时先使旧回调失效，再清除 GPS 监听、取消浏览器请求、撤销延迟跳转，并清空运行中的位置引用。迟到的成功、错误和旧会话收尾均不能改变新定位状态。

切换日期、打开另一份路线、退出账号或页面关闭时，原定位结束；需要时再点“开始地图导航”。日期选择默认明确显示第 1 天。重复点击开始不会创建多个监听。

取消浏览器请求不能撤回已发送至服务器的内容，也不能保证终止服务器或上游已经开始的处理；本次防止继续发送旧会话的位置、显示旧路线或执行旧跳转。没有新增位置轨迹存储。

## 手动安装

将 `TripMate-server-v72-update.zip` 上传至服务器 `/home/ubuntu/`：

```bash
mkdir -p /home/ubuntu/tripmate-update-v72
cd /home/ubuntu/tripmate-update-v72
unzip -t /home/ubuntu/TripMate-server-v72-update.zip &&
unzip -o /home/ubuntu/TripMate-server-v72-update.zip -d . &&
sudo bash ./update-tripmate.sh
```

健康检查预期 `v72-navigation-lifecycle`。国际站配套 `TripMate-pages-v72-upload.zip`，手动上传到原 Cloudflare Pages `tripmate` 项目。

保留账号、行程、订单、AI 额度和 SMTP、DeepSeek、高德、美团、HTTPS 配置，无数据库迁移。APK/EXE 未重新打包，沿用原包名、签名与用户目录。本次未部署远程服务器或国际站。
