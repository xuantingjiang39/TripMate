# v60 合并与共享旅行记录

入口：两站网页顶部“设置 → 合并 / 共享记录”，或直接访问 /account-link。

## 怎么用
1. 先更新国内服务器，打开国内 /account-link，登录本人账号，生成一次性连接码。
2. 在国际 /account-link 登录本人账号，粘贴连接码，勾选账号归属与记录传输授权，再预览。
3. 检查两边账号、数量及行程标题。行程/订单/提醒/费用/行李合并，编号和内容都相同才去重，不同编号的订单完整保留。冲突编号保留两份；另一草稿存入我的行程，偏好/应急卡选择哪边生效，原始内容均保留备份。
4. 可下载两边原始备份，勾选确认后启用共享。返回工作台刷新。
5. 两站仍分别登录；密码、管理员权限、AI 额度与充值账本不合并。国际站读写国内主记录，国内不可达时保留本机修改并提示失败。
6. 国际站解除共享前先保留最新副本；国内站可随时停用共享访问。历史备份在云端备份按钮返回的历史入口下载。

## 升级国内服务器
```
mkdir -p /home/ubuntu/tripmate-update-v60
cd /home/ubuntu/tripmate-update-v60
curl -fL --retry 3 -C - https://github.com/xuantingjiang39/TripMate/releases/download/v60/TripMate-server-v60-update.zip -o update.zip && unzip -o update.zip && sudo bash update-tripmate.sh
```
服务器已安装 v59 时，已有的正确 APK/EXE 会复用，不必重复下载。无需重配邮箱、密钥和 HTTPS，无新 APK。完整本地包 TripMate-server-v60-regional-sync.zip 可直接上传 /home/ubuntu 后解压更新。

## 边界
国际托管服务不能通过 fetch 直接访问 IP 地址。浏览器在明确授权后直接连接固定国内 IP 的受限同步接口；CORS 仅允许官方国际站，不跨站发送 Cookie/密码。连接令牌只在运行内存与账号私有服务端存储中使用，不放在网址或 localStorage。国内主库持久保存原记录，国际原始记录/历史备份不删除。
合并预览容量限制 1.4MB（含原始备份），超出则拒绝并保留记录，不截断。数据冲突需重新预览；本机同步冲突时先导出本机记录，再明确选择采用云端副本。

验证为隔离本地 HTTP、SQLite D1 适配器和桌面/手机浏览器合成账号流程；不等于生产真人账号、真实跨境网络或真机验证。不会替用户自动合并账号，也不会自动部署腾讯云。
