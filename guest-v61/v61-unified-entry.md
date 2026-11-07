# v61 · 两个入口，同一个 TripMate

## 使用
先更新国内服务器。国内网址 https://111.230.133.155 与国际网址 https://tripmate-travel-planner.xuantingjiang39.chatgpt.site 使用同一份主页面、同一个原国内账号密码、行程、订单、AI额度及DeepSeek/高德/美团/SMTP等业务服务。无需新注册国际账号、无需连接码，也不互传文件。
两个网址有各自浏览器会话；首次分别用同一个账号登录。国际入口前端由全球托管提供，业务仍共用国内服务器，并未配置独立国外业务服务器。国内业务不可达时两个入口的在线业务都会受影响。
打开页面且网络正常、没有本机未保存修改时，每15秒检查新记录；回到页面或网络恢复也检查。保护当前编辑、在途保存和版本冲突，不静默覆盖本机修改。

## 更新国内
```bash
mkdir -p /home/ubuntu/tripmate-update-v61
cd /home/ubuntu/tripmate-update-v61
curl -fL --retry 3 -C - https://github.com/xuantingjiang39/TripMate/releases/download/v61/TripMate-server-v61-update.zip -o update.zip && unzip -o update.zip && sudo bash update-tripmate.sh
```
已有APK/EXE校验正确时复用，不重复下载。无需重填任何邮箱/AI/地图/酒旅密钥及HTTPS；无新APK。安装后浏览器Ctrl+F5刷新，再用原国内账号登录两个入口。

## 旧国际站记录
独立国际站的旧账号/数据表与备份不删除。保留区 /legacy 可验证旧账号，/legacy-records 可在证明两个账号归属后预览并迁入统一账号。旧区只用于恢复，不开放新注册、AI或普通业务写入；不会按同名邮箱自动合并，不复制密码/角色或累加额度。
日常统一站不读取旧国际未分账号的localStorage副本，避免误导入别人的内容。

## 安装脚本修复
v60安装ZIP中的install.sh、update-tripmate.sh被Windows写成CRLF，导致Linux第2行pipefail报错。v61脚本全部LF无BOM，打包器不依赖工作区换行设置，并对ZIP内实际脚本、CRC、路径和安装文件SHA256进行检查。已修复并成功装好v60的用户不必为换行问题重复安装；这次v61用于统一入口的新功能。

## 验证范围
本地隔离HTTP/SQLite及Chrome桌面/手机视口验证通过；使用合成账号，无真人账号迁移、无邮件/付款/收费AI调用。Git Bash仅执行bash语法检查，没有在Windows实际执行Linux安装过程。实际跨境网络与本人登录需用户手动安装国内v61后验收。
