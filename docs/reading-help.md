# 阅读帮助：点词、原句与语境

本轮在 `D:\Codex_product\LumaRead` 的 `codex/learning-reader-20260926` 分支开发。
未修改其他 worktree，也未改动系统环境变量、用户书库或应用安装目录。

## 使用

1. 从本工作区启动 `npm run tauri:dev`，或使用本工作区重新构建的程序。旧工作区和旧安装包不会自动更新。
2. 导入 TXT、EPUB、DOCX 或有文字层的 PDF。点击正文英文单词，查看离线中文释义、词形及原句。
3. 选中短语或句子后点击工具条的“理解”；键盘可按 `Ctrl+Shift+L`。PDF 原版布局选择后有“理解所选文字”入口。
4. 需要 AI 时，在首页“阅读帮助与解释服务设置”或查词卡片右上角的“解释服务设置”图标中填写 API Base URL、模型 ID 和 API Key。
5. 点击“这里是什么意思”“原句翻译”或“Simple English”才发送请求。默认解释简短，`Explain more` 才请求详细结构说明。
6. “懂了，继续读”、关闭按钮或 Esc 关闭卡片。Esc 在嵌入设置时先返回卡片，再关闭卡片，不直接退出 Reader。

### 2026-09-28 修复版

- 点词后，正文有临时淡紫底色/下划线，原句中同一处词也有标记；关闭卡片即消失，不产生永久高亮或学习任务。重复单词按实际选择位置标记，跨 span 的单词不会被拆开。
- 卡片显示词库音标及“发音 / 慢速 / 停止”。Windows 使用本机英语 SAPI，Android 使用系统离线英语 TTS，浏览器使用 Web Speech。不需要 API Key；未安装英语语音会明确提示，不自动安装或修改系统。
- 若只有原形音标，会标出原形名称；读音始终朗读你选中的词。词库没有音标时不会使用 AI 编造。
- 官方 DeepSeek 地址会明确发送非思考模式，普通解释 1200 / 详细解释 2400 token 上限。保留用户填写的模型，不偷偷更换模型。输出长度仍受简短阅读提示约束。
- 余额不足、限流、输出额度耗尽、仅返回思考过程、超时各有反馈；失败不自动重复产生收费请求。读书内解释和设置页连接测试使用相同 provider。
- 点击解释后，解释区域会进入浮窗可见区域；仅滚动浮窗，不改变阅读位置。关闭按钮保持可见。
- Windows / Android 版可勾选“在此设备安全记住密钥”，分别使用 DPAPI / Android Keystore，保存后重启无需重填。浏览器仅为会话密钥；设置页底部“构建”可区分新旧程序。

支持兼容 Chat Completions 的服务，以及本机 Ollama `/api/chat`。模型 ID 由用户按服务商账户/本机安装情况填写，不自动猜测。
例如 DeepSeek API Base URL 为 `https://api.deepseek.com`，可兼容包含 `/v1` 的服务地址；也支持输入完整 `/chat/completions` 端点。
本机 Ollama 可用 `http://localhost:11434`；远程地址必须 HTTPS。

## 隐私、成本与数据

- 本地英汉词典不发出远程请求，不需要 API Key。离线词库并不覆盖所有专名、俚语或词形，未命中会明确提示。
- Windows 密钥通过当前账户 DPAPI 加密；Android 密钥通过 Keystore 中的 AES-GCM 密钥加密，存入应用私有 no-backup 目录。两者绑定完整模型端点，不把持久密钥返回 WebView。不写明文到 localStorage、IndexedDB、日志或 Git。更改服务地址/协议会清空表单密钥，已保存密钥不会发到其他地址。可随时清除；安全存储失败没有明文持久化回退。
- AI 仅收到所选文本（最多 600 字符）与当前原句/局部语境（最多 1600 字符），不发送书名、完整书籍、查询历史或能力画像。
- 测试连接使用固定测试句，可能产生少量服务商用量。没有 API Key 时不会伪造 AI 结果。
- 查询保存在独立 `lumaread-learning` IndexedDB v2，兼容原 v1 的查询与学习状态。新增阅读会话、复习卡与反馈记录；不会改动既有文档数据库版本或迁移用户书库。
- 查词不自动加入复习。只有显式“加入学习”才将表达标为 learning，可以撤销。Quick Review 已接入 `ts-fsrs@5.4.2`，每轮最多 5 个到期表达，使用真实原句和离线词典；自评只调整下次时间，跳过不记答错，不自动推断主动运用能力。
- 首页 Stats 进入 `/statistics` 查看阅读时长、来源、查词、学习表达与复习历史。无签到、任务、正确率和追赶提醒。反复查询只产生可选建议，最多 5 项。
- 阅读时间只在阅读页有焦点且可见时估算；2 分钟无交互暂停，操作恢复。每 10 秒保存，离开尽力补存；强制结束/断电可能损失最后一小段记录。关闭计时不删除旧记录，也不影响手动查询和复习的保存。
- 查询记录位于二级设置页，最多展示最近 20 条，不在首页制造任务压力。
- AI 内容以纯文本显示；取消、切换查询、离开阅读时不应用过期响应。网络失败不会阻断离线词义。

## 实现边界

- `src/features/learning/`：词典、服务配置与 Provider、选词/选句、查询仓储与面板。
- `src-tauri/src/reading_context.rs`：受限原生 HTTP 通道，HTTPS/本机 HTTP、禁止重定向、请求并发及大小限制、超时和取消。前端 CSP 仅增加官方要求的 `ipc:` 与 `http://ipc.localhost`，没有开放远程通配地址。
- `src-tauri/src/reading_speech.rs`：Windows 本机英语语音，限制 600 字符、普通/慢速两档、可取消，禁止将所选文本解释为 XML 或文件路径；不写系统语音设置。
- `public/dictionary/`：ECDICT 筛选词库，按词首分片读取；来源见 `THIRD_PARTY_NOTICES.md`。
- Reader 保留原有正文 DOM、分页、标注与内部链接；点击链接/高亮优先原功能，不抢占文本选区。
- 扫描 PDF 没有文字层，暂不支持点词或 OCR。PDF 的局部语境按文字层顺序提取，多栏/复杂版面可能不可靠，可切 Reading View 或选中完整句子。
- AI 内容筛选、能力画像、云同步暂未实现。阅读统计、轻复习完全本地，不调用模型服务，也不启动系统后台监控。Android 安装、备份与验收说明见 [android.md](android.md)。

## 验证与备份

```powershell
npm run typecheck
npm run test
npm run lint -- --max-warnings=0
npm run build
npm run test:reading-help
# 检查生产静态资源，而非 Vite 开发模块：
$env:READING_HELP_PREVIEW = '1'
npm run test:reading-help
Remove-Item Env:READING_HELP_PREVIEW
cargo test --manifest-path src-tauri/Cargo.toml --lib
```

浏览器测试使用合成书籍和本机 HTTP 契约测试服务，不调用真实付费模型。测试证据保存在项目内 `.qa-artifacts/reading-help/`，不提交 Git。
开发前完整 Git bundle 位于 `.local-backups/before-learning-20260926.bundle`；阶段及最终备份也仅保存在该项目内目录。不包含 API Key 和用户书库。

Windows 原生 UI 与 Android 实机验证须单独记录，不把浏览器模拟尺寸或 Rust HTTP 单测当作原生点击验收。
