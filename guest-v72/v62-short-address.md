# v62 短网址

国际入口：https://tripmate.xuantingjiang39.chatgpt.site
下载页：https://tripmate.xuantingjiang39.chatgpt.site/download
同一Sites项目，账号/数据绑定和公开权限不变。新网址与旧网址均精确加入国内CORS白名单，不使用通配域名。站点切换、下载、统一登录识别、旧记录恢复链接全部更新。
换网址后需重新登录；数据库记录不删，旧域名的浏览器会话不自动复制到新域名。两个网址日常仍使用原国内账号、同一套数据和额度，业务共用国内后端。

## 安装国内
```
mkdir -p /home/ubuntu/tripmate-update-v62
cd /home/ubuntu/tripmate-update-v62
curl -fL --connect-timeout 15 --retry 3 -C - https://github.com/xuantingjiang39/TripMate/releases/download/v62/TripMate-server-v62-update.zip -o update.zip && unzip -o update.zip && sudo bash update-tripmate.sh
```
可以从v60直接升级，不用先安装v61。已有APK/EXE复用，无需重填配置，无新APK；保留账号、记录、额度与所有现有服务密钥。
