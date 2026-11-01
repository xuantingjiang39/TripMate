# 参与 TripMate / Contributing

欢迎反馈安装和使用问题、改善旅行规划体验、提交修复或改进文档。

## 反馈问题

使用 [问题模板](https://github.com/xuantingjiang39/TripMate/issues/new/choose)，说明设备、系统、版本、复现步骤和期望结果。截图请遮住私人信息，不要公开密码、验证码、API 密钥或精确位置轨迹。

较大的新功能可先在 [Discussions](https://github.com/xuantingjiang39/TripMate/discussions) 讨论具体使用场景。

## 提交修改

1. Fork 本仓库，并为改动创建分支。
2. 先读 README.md、PROJECT.json 和 AGENTS.md，确认对应组件的当前源码。
3. 保持改动聚焦，保留账号、行程、额度和现有配置；不要提交私人数据与服务密钥。
4. 运行与改动相关的现有检查，说明哪些是模拟测试、哪些是真机测试。
5. 提交 Pull Request，描述问题、改动和验证结果。UI 改动请附对应界面截图。

Windows 检查：进入 `TripMate-desktop-v54` 后运行 `npm test`。完整桌面检查 `npm run test:desktop` 使用隔离配置和模拟场景，首次会读取线上匿名登录页；不要用真实账号做自动化测试。移动端检查：进入 `TripMate-native-v52` 后运行 `npm run verify`。

不要为了演示调用付费 AI、真实支付、发送邮件或部署服务器。未选择项目整体许可证；第三方代码保留原许可证，新增第三方依赖请先说明来源与许可。

English feedback and focused pull requests are welcome. Please include reproducible steps and distinguish mocked checks from device or live-service testing. Keep credentials and personal data out of issues and commits.
