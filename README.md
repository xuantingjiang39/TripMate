<img src="docs/media/tripmate-icon.png" alt="TripMate 路线与日出图标" width="88" height="88">

# 旅伴 TripMate

**带爸妈旅行，少走冤枉路。把每天去哪、怎么去、何时休息，整理成可以修改和分享的行程。**

中文 · [English](README.en.md)

[网页体验](https://111.230.133.155/) · [下载 Windows](https://github.com/xuantingjiang39/TripMate/releases/download/v54/TripMate-v54-Windows-1.0.1-Setup.exe) · [下载安卓 APK](https://github.com/xuantingjiang39/TripMate/releases/download/v54/TripMate-v52-android-v1.1.4.apk) · [反馈问题](https://github.com/xuantingjiang39/TripMate/issues/new/choose) · [参与讨论](https://github.com/xuantingjiang39/TripMate/discussions)

TripMate 面向希望提前安排好家庭出游的人。先写清目的地、天数、预算与同行人的需要，再逐日查看和修改行程、交通及费用，出发前把 PDF 发给家人。

当前为 **Beta 体验阶段**。安装包可免费下载；AI 生成使用服务器配置的模型与额度，以页面价格提示为准。游客可体验一次并预览第 1 天，完整行程需注册登录。

## 可以用来做什么

- **安排轻松的家庭旅行**：填写同行长辈、出行节奏、休息与必去地点等要求。
- **查看并编辑每日行程**：把草稿改成适合自己的安排，保存后继续使用。
- **整理交通和预算**：查看分段交通与费用，出行前再次核实班次、票价和预约。
- **把行程分享给家人**：Windows / 网页可导出行程 PDF；安卓可查看和管理行程。
- **查找住处和餐厅**：根据服务器启用的高德、美团等接口显示来源资料；未返回的数据不补造。
- **查看当前行程与下一站**：已有地图、定位和导航衔接功能，支持与否及准确性取决于设备、权限和接口范围，仍需更多真机反馈。

例如：

> 带妈妈去杭州玩 3 天，预算 5000 元，节奏轻松，每天安排午休，尽量减少连续步行。

## 看看使用界面

![TripMate 工作台与示例行程界面轮播](docs/media/interface-preview.gif)

上图为真实桌面 UI 使用示例数据的界面轮播，未使用真实账号或私人行程；它不是实时 AI 生成或 GPS 导航的录屏。

<details>
<summary>查看行程示例截图</summary>

![可编辑的每日行程示例](docs/media/itinerary-example.png)

</details>

## 三步开始

1. 打开网页，或下载适合设备的安装包；先进入游客体验也可以。
2. 填写出发地、目的地、天数、人数、预算和同行人的需要。
3. 查看每日安排，调整后保存；出发前核实交通、价格和预约信息。

## 欢迎试用和提意见

目前最需要这三类反馈：**能否顺利安装和打开、行程是否容易理解、哪里让人走了弯路**。

[报告使用问题](https://github.com/xuantingjiang39/TripMate/issues/new/choose) · [讨论产品想法](https://github.com/xuantingjiang39/TripMate/discussions)

如果 TripMate 对你有帮助，可以 Star 关注后续更新。也欢迎通过 [贡献说明](CONTRIBUTING.md) 提交修复或文档改进。

## 当前实现与验证范围

Windows 版是加载现有在线工作台的 Electron 客户端；安卓使用 React Native / Expo；服务器使用 Node.js。Windows 需要联网，安卓离线副本保护不等于离线 AI 生成。AI、地图和酒旅供给依赖配置后的第三方服务。

已有桌面安装启动、PDF 导出、断网恢复及安卓同步保护等验证。部分流程使用模拟接口；真实支付、酒店库存、GPS 精度和不同手机兼容性尚未全面验证。Windows 安装包尚未商业签名。

源码公开，项目整体许可证尚未指定；第三方组件遵循各自许可证。本地历史版本与用户数据不包含在此仓库中。

以下为当前源码入口与开发说明，更新于 2026-11-07。

## 从哪里继续开发

| 部分 | 当前源码 | 当前版本 | 说明 |
| --- | --- | --- | --- |
| Windows | [TripMate-desktop-v54](TripMate-desktop-v54/README.md) | 1.0.1 / v54 | Electron 联网桌面客户端，路线与日出新图标 |
| Android / 原生移动端 | [TripMate-native-v52](TripMate-native-v52/README-原生App.md) | 1.1.4 / v52 | 同步响应与离线攻略保护 |
| 服务器与网页 | `guest-v56/` | v56-request-isolation | 修复异常 Cookie 导致整个服务退出；v56 待手动部署，线上最后确认 v55 |

Android 本地原生构建工作目录另在 `C:\tmb`，工具链在 `android-toolchain/`。不要把 Windows 桌面版覆盖到 Android 源码目录。

当前 Windows 版沿用服务器网页，因此原生 Android 的独立实现不会自动迁移到 Windows 客户端。

## 下载安装包

- [v56 服务器稳定性修复包](https://github.com/xuantingjiang39/TripMate/releases/download/v56/TripMate-server-v56-request-isolation.zip)：隔离异常请求，保留账号、行程、订单、额度及配置。详见 [v56 验证与安装说明](guest-v56/v56-请求隔离修复说明.md)。

网站已更新至 v55，顶部与登录页均有「软件下载」入口，[下载页](https://111.230.133.155/download) 可免登录选择安卓或 Windows；iPhone / iPad 提示使用网页版。安装文件来自下方 GitHub Releases，详情见 [v55 安装说明](guest-v55/v55-软件下载说明.md)。

- [v55 服务器与网页更新包](https://github.com/xuantingjiang39/TripMate/releases/download/v55/TripMate-server-v55-downloads.zip)

- [Windows 安装版 1.0.1](https://github.com/xuantingjiang39/TripMate/releases/download/v54/TripMate-v54-Windows-1.0.1-Setup.exe)
- [Windows 便携版 1.0.1](https://github.com/xuantingjiang39/TripMate/releases/download/v54/TripMate-v54-Windows-1.0.1-portable.zip)
- [Windows 源码包](https://github.com/xuantingjiang39/TripMate/releases/download/v54/TripMate-v54-Windows-1.0.1-source.zip)
- [Android APK 1.1.4](https://github.com/xuantingjiang39/TripMate/releases/download/v54/TripMate-v52-android-v1.1.4.apk)
- [Android 安装包与说明](https://github.com/xuantingjiang39/TripMate/releases/download/v54/TripMate-v52-android-v1.1.4-sync-protection.zip)

源码和安装包均可免登录访问。上述文件在本地根目录也保留原文件名。

Windows 已安装位置：`C:\Users\Administrator\AppData\Local\Programs\TripMate`。

## 开发和验证

Windows：

```powershell
cd C:\codex\TripMate\TripMate-desktop-v54
npm test
npm run test:desktop
npm run dist
```

从 GitHub 首次下载源码时，先进入对应组件目录运行 `npm ci`。Windows 若尚未下载 Electron 运行时，再运行 `node node_modules/electron/install.js`。图标重建另需 FFmpeg；现成图标已随源码提供。

原生移动端：

```powershell
cd C:\codex\TripMate\TripMate-native-v52
npm run verify
```

Windows 流程检查使用隔离的临时用户目录，真实接口只检查匿名登录页面；后续账户、游客及异常场景使用本地夹具，不提交真实密码或调用付费 AI。

## 文档

- [当前版本清单](PROJECT.json)
- [后续开发约定](AGENTS.md)
- [Windows 图标与生成说明](TripMate-desktop-v54/图标说明-v54.md)
- Windows v54 验证记录保存在本地 `release-v54/验证记录.md`。
- [Android v52 升级说明](TripMate-native-v52/升级说明-v52.md)
- [编辑器工作区](TripMate.code-workspace)

在 Codex 添加本地项目时，将本目录 `C:\codex\TripMate` 设为主文件夹，项目名称使用“TripMate”。不需要先移动旧文件或重新部署服务器。

## GitHub 同步

仓库只提交当前源码和文档，根目录 .gitignore 明确排除历史产物、依赖、缓存和本地数据。新建版本目录后，应先更新白名单并检查 `git diff --cached --stat`，再提交上传。不要强制添加密钥、配置文件或用户数据库。

安装包大文件通过 Releases 上传，不放进 Git 历史。上传 GitHub 不会自动更新线上 TripMate 服务。
