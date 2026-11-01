# 旅伴 TripMate 原生 App

这不是网页外壳，也不使用 WebView。界面由 React Native 原生控件构成，并分别生成 Android 与 iOS 工程。账号、AI 和高德路线继续由 TripMate 服务器提供。

## App 已包含

- 原生登录、邮箱注册、游客体验和系统安全存储。
- “今天、规划、行程、我的”四个原生主导航。
- AI 行程生成、额度评估和账号数据同步。
- 实时行程：仅在用户点击开始后询问前台位置权限。
- 拒绝定位后可手动输入当前位置。
- 根据位置、时间和行程顺序推断当前步骤，显示下一站距离、预计步行时间和分段路线。
- 一键打开高德继续导航。
- iOS 深色模式、安全区、系统返回手势；Android 深色模式、系统返回和 Predictive Back。

## v52 / 1.1.4 更新

本版增加同步返回校验，避免格式异常时用空数据替换本机攻略；保存确认异常时保留待同步更改。安装与验证范围见 [升级说明-v52.md](升级说明-v52.md)。已提供可直接覆盖安装的 APK；普通使用者无需在服务器运行命令。此前版本的升级记录仍保留在源码中。

## 开发环境

1. 继续使用现有已启用 HTTPS 的 TripMate 服务端。本项目已配置当前服务器地址。
2. 在 App 目录运行：

```bash
npm run configure -- https://111.230.133.155
npm run verify
npm run prebuild
```

3. 使用现有 v43 或更高的兼容服务端，不要为了构建本 App 降级到旧安装包。

## Android

安装 Android Studio、Android SDK 和 JDK 后生成并打开 `android/`。覆盖已有 App 时务必沿用之前的签名证书。先用真机测试，再在 Android Studio 生成签名 AAB 或 APK。

## iOS

将项目复制到 Mac，安装 Xcode 后打开 `ios/TripMate.xcworkspace` 或 Expo 生成的工作区。选择自己的 Apple Developer Team，在真机测试后 Archive 上传 TestFlight。

如果没有 Mac，也可以登录自己的 Expo/EAS 账号后使用云端构建：

```bash
npx eas-cli build --platform android --profile preview
npx eas-cli build --platform ios --profile production
```

iOS 云构建仍需要你自己的 Apple Developer 账号；签名凭证只应交给 Apple、Expo EAS 或保存在自己的 Mac 中。

定位权限由系统弹窗决定，App 不申请后台定位。商店发布前仍需准备正式隐私政策网址和如实填写位置数据用途。
