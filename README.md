# 旅伴 TripMate

旅行规划、酒店与餐厅查询、行程管理和地图导航项目。本地目录保留历史版本；GitHub 仓库只跟踪下面列出的当前三端源码，安装包通过 Releases 分发。

本文件更新于 2026-11-01。此前版本保留原路径，未为整理项目移动或删除文件。

GitHub：[`xuantingjiang39/TripMate`](https://github.com/xuantingjiang39/TripMate)（公开）。主分支为 `main`，当前安装包在 [v54 Releases](https://github.com/xuantingjiang39/TripMate/releases/tag/v54)。

## 从哪里继续开发

| 部分 | 当前源码 | 当前版本 | 说明 |
| --- | --- | --- | --- |
| Windows | [TripMate-desktop-v54](TripMate-desktop-v54/README.md) | 1.0.1 / v54 | Electron 联网桌面客户端，路线与日出新图标 |
| Android / 原生移动端 | [TripMate-native-v52](TripMate-native-v52/README-原生App.md) | 1.1.4 / v52 | 同步响应与离线攻略保护 |
| 服务器与网页 | `guest-v43/` | v43-real-map-navigation | 现有线上服务器最后经只读健康检查确认的版本 |

Android 本地原生构建工作目录另在 `C:\tmb`，工具链在 `android-toolchain/`。不要把 Windows 桌面版覆盖到 Android 源码目录。

当前 Windows 版沿用服务器网页，因此原生 Android 的独立实现不会自动迁移到 Windows 客户端。

## 下载安装包

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
