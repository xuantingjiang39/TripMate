# v73 来源地址限流加固：验证记录

2026-11-21，基线为 `guest-v72`。变更仅涉及服务器地址识别逻辑和安装时复制该模块；国内与国际线上状态仍以 v70 为最近观测，本次未部署。

## 发现

`clientAddress()` 直接采用 `X-Forwarded-For` 的第一个值。Nginx 配置使用 `$proxy_add_x_forwarded_for`，会把访问者原有输入保留并追加网络对端地址；攻击者可每次改写首个值，绕过依赖 IP 的登录失败限制和游客每日创建次数限制，也会伪造会话设备地址信息。

## 修复

- 只在 TCP 对端为 Nginx 本机回环地址时，信任 `X-Real-IP`。
- 验证代理地址为合法 IPv4/IPv6；缺失或异常时退回 TCP 对端地址。
- 任何非回环 TCP 连接都忽略 `X-Real-IP` 与 `X-Forwarded-For`。
- 安装和更新脚本都会把新模块放到 `/opt/tripmate`，与服务器入口模块同目录；更新前检查模块存在并通过 Node 语法检查。

## 验证

- `node --check` 检查地址模块和完整服务器入口：通过。
- `verify-v73-proxy-address.mjs` 的单元用例覆盖本机代理、伪造 `X-Forwarded-For`、非本机直连、无效代理 IP、IPv6：通过。
- 用独立临时目录启动真实本机 HTTP 服务，连续 4 次向游客接口发送相同 `X-Real-IP`、不同伪造 `X-Forwarded-For`；结果为前三次 HTTP 200、第四次 HTTP 429。账号文件只记录 3 个合成访客且哈希来源一致：通过。
- 相同代理 IP 对登录接口发送不同伪造 `X-Forwarded-For`：前 12 次合成错误登录为 HTTP 401，第 13 次按同一 IP 被 HTTP 429 拦截：通过。
- 现有真实用户库、SMTP / DeepSeek / 高德 / 美团环境和服务未被读取或更改；无付费接口、真实账号或网络部署。
- 更新包共 61 个文件，ZIP CRC 全部通过；不含数据库、密钥文件、APK 或 EXE。解压后的服务器与代理限流集成验证通过。SHA-256：`2b05c24487dcd0d48826117aabfc17de0bf3c620df94d0eea7d56e207d44c357`。

## 限制

这里验证的是本机 Nginx 直连 Node 的既有部署结构。若未来把 Nginx 迁到其他机器或在前面增加负载均衡，需要明确配置可信代理地址，不应直接扩大可信任头的来源范围。生产服务器是否安装 v73 需用户按说明手动更新后另行检查。

## 更新命令

```bash
mkdir -p /home/ubuntu/tripmate-update-v73
cd /home/ubuntu/tripmate-update-v73
unzip -t /home/ubuntu/TripMate-server-v73-update.zip && \
unzip -o /home/ubuntu/TripMate-server-v73-update.zip -d . && \
sudo bash ./update-tripmate.sh
```
