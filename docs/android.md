# Android 手机版

## 安装与开始阅读

将 `dist-android/` 下不带 `-debug` 的签名 APK 发送到手机，在文件管理器中打开。仅对你用来打开这个可信 APK 的应用授予安装权限，安装后可以收回；不需要关闭系统安全防护。当前安装包只包含 `arm64-v8a`，不适用于 32 位手机或 x86 模拟器。

1. 打开 LumaRead → Library → Import document，使用系统文件选择器选择 EPUB / TXT / DOCX / PDF。
2. 在 Reader 点击英文单词查看离线释义和音标；选中句子后点击“理解”。手机使用底部面板，不常驻占用正文空间。
3. 在首页的阅读帮助设置中配置 DeepSeek 等 HTTPS 服务、模型和 API Key。电脑上的密钥不会自动复制到手机。
4. 勾选“在此设备安全记住密钥”后保存。密钥使用 Android Keystore 加密，重启后无需重新填写；可在设置中清除。
5. 发音使用 Android 系统 TTS 的离线英语语音。若提示缺少语音，请在手机“文字转语音”设置中自行下载英语语音；应用不会自动下载或上传所选词句。
6. 返回键优先关闭查词/设置/编辑面板，再退出阅读到首页；在首页返回才结束 Activity。

阅读记录、查词、书签、笔记、轻复习都保存在手机本机。没有账号或云同步，不监控其他应用。首次打开无需联网；只有主动调用模型解释才发送当前选词与局部语境。扫描 PDF 可显示原版页面，但没有 OCR/点词能力。

**更新时直接安装同签名新版，不要先卸载。** 卸载或清除应用数据会删除本机书库、阅读记录和密钥。系统自动云备份已关闭；本版本暂不提供跨设备数据导出。`localhost` 指手机本身，不是电脑；手机上的远端 AI 服务请使用 HTTPS。

最低 manifest 为 Android 7.0 / API 24；这不代表所有旧 WebView 都已兼容验证。建议使用较新的 Android 与系统 WebView。当前没有真机覆盖清单，兼容性需要实测。

## 可重复构建（当前 Windows 开发机）

```powershell
npm run build:android
# 开发调试包（签名不同，不能作为正式版的无损覆盖更新）
npm run build:android -- --debug
```

构建脚本读取已安装的 JDK 17、Android SDK 36、Build Tools 35.0.0、NDK 29 与 Rust Android target，不安装或修改系统工具。可通过仅当前进程的 `LUMAREAD_JAVA_HOME`、`ANDROID_HOME`、`NDK_HOME` 指定已安装工具。当前脚本仅支持 Windows。

- 项目缓存、临时文件：`.local-cache/`。
- APK：`dist-android/`，文件名包含 Git 提交与架构。
- 构建日志、签名验证与 SHA-256：`.qa-artifacts/android/`。
- **私有签名备份**：`.local-backups/android-signing/lumaread.p12` 和 `signing.json`。后者含签名密码；两者均被 Git 忽略。不要随 APK 分享，不要上传仓库。务必在你自己可信的离线备份中保留这两份文件，否则不能继续为已安装版本提供同签名升级。

脚本首次正式构建生成签名身份，后续复用；不会覆盖已有身份。只复制通过 `apksigner verify` 的安装包。源码 Git bundle 不包含签名文件、API Key 或用户书库。

## 原生桥与安全边界

- `ReadingMobilePlugin.kt`：AES-GCM + Android Keystore、应用私有 no-backup 目录；存储按端点绑定，命令不返回密钥明文。
- 原生 HTTPS POST：固定模型端点、禁止跳转、请求/响应大小上限、超时、取消和并发上限；不记录 API Key/响应错误正文。
- 原生离线英语 TTS：仅选择离线英语 voice；关闭面板、离开应用时停止。
- `AndroidNavigation.tsx` 复用 Reader 的 Escape 优先级和退出保存逻辑；原生 Activity 处理系统栏、刘海和软键盘 inset。
- 应用只声明 INTERNET 权限；导入通过系统文件选择器取得用户选择的文件，不扫描手机存储。

实现参考：[Tauri 原生移动插件](https://v2.tauri.app/develop/plugins/develop-mobile/)、[Android Keystore](https://developer.android.com/privacy-and-security/keystore)、[系统 TTS](https://developer.android.com/reference/android/speech/tts/TextToSpeech)。

## 真机验收（构建与浏览器测试不替代这些项目）

- 安装、冷启动、关闭再打开，Home 正常；无状态栏/导航栏遮挡。
- 文件选择/取消，四种格式导入，Continue Reading 恢复。
- 竖屏/横屏、EPUB Pages、左右滑动、PDF 缩放/翻页与文字选择。
- 点词标记、底部词典、发音/停止、句子解释；模型请求失败可重试且不阻塞阅读。
- API Key 保存后强制关闭重开，仍可解释；更换服务地址不复用旧密钥；清除有效。
- 软键盘打开时设置表单/笔记可滚动，返回优先关闭键盘/面板而不误退出。
- 后台停留不累积阅读时间，查词不自动加入复习，显式加入后能轻复习。
- 同签名覆盖更新后书库与阅读记录保留。

尚无连接的 Android 设备时，这些项目必须标为未验证，不能凭 APK 构建成功宣称全部通过。
