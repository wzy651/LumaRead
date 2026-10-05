# LumaRead Engineering & Product Principles

本文件适用于整个仓库，保存长期稳定的产品与工程规则，不保存某个新功能的设计、任务计划或验收记录。开发前阅读本文件及相关目录下更具体的规范；历史阶段文档需结合当前代码核实，不能把原型期假设当作现状。

## Product

LumaRead 是一个低打扰的沉浸式英语学习阅读器。

产品优先级：**Reading > Understanding > Learning > Data**。

- 优先保护连续阅读；查词、解释和学习操作应易于关闭并返回原文。
- 学习由用户主动选择；查词或重复查词不得自动加入复习。
- 统计用于帮助用户理解自己的阅读，不应成为阅读的门槛。
- 禁止为了游戏化加入 XP、金币、排行榜、强制每日任务或制造焦虑的待完成数量。

## Platforms

- 核心用户功能必须同时考虑 Windows 和 Android，不能假设桌面交互在移动端同样成立。
- 交互变更必须检查 mouse、keyboard、touch、Android back behavior、safe area 和 lifecycle。
- 核心操作不能仅依赖 hover 或键盘快捷键。共享业务语义和状态，按需要适配桌面面板与移动底部面板，避免复制两套业务逻辑。
- 检查窄屏、横竖屏、窗口大小变化、软键盘和系统栏遮挡；不能通过隐藏核心功能完成移动适配。
- 返回操作应遵守现有面板、编辑和退出优先级，保护未保存笔记与阅读位置。
- 检查后台、恢复、卸载组件和关闭应用时的位置保存、计时、监听清理、异步请求取消与发音停止；后台停留不得计入有效阅读时间。
- 浏览器预览、响应式模拟和 APK 构建成功不能替代 Windows 原生应用与 Android 真机验证；未验证的项目必须明确标注。

## Reader Safety

Reader 是高风险核心模块。修改 Reader、文档解析、布局、导航或共享交互时，不得破坏：

- 阅读位置保存与恢复，包括退出、重新打开、布局变化和阅读模式切换。
- EPUB 导航、PDF 导航、TXT / DOCX 阅读。
- 目录、搜索、内部链接、脚注与跳转返回。
- 书签、高亮、笔记、查词和阅读设置。

遵守现有文档能力契约，不假设所有格式都支持相同操作。EPUB / TXT / DOCX 的可重排内容与 PDF 固定页面可以共享控制语义，但保留必要的渲染差异。

修改分页、字号、宽度或缩放时检查内容是否丢失、重复、截断以及位置能否恢复。修改正文结构、section / block ID 或 locator 时，同时检查搜索、链接、书签和批注锚点；无法定位的旧批注应保留并可解释，不能直接删除。

解析失败、缺失源文件或无文字层等情况必须有明确的降级行为，不能静默换成演示内容或虚构格式能力。

## Data Safety

不得静默删除、重置或破坏现有用户数据，包括 books、reading positions、vocabulary、FSRS state、review history、notes、highlights、settings 和 reading statistics。用户明确执行的删除或移出学习操作仅影响其授权范围。

任何 schema 或持久化结构变更必须考虑：

- backward compatibility：保留旧记录、稳定标识、关联关系和既有设置的读取能力。
- migration：提供明确、可重复执行的升级路径；迁移失败不能靠清空数据库恢复。
- corrupted / missing data：区分缺失、损坏和存储不可用；安全降级，不覆盖仍可恢复的数据，不宣称未成功的数据已保存。
- tests：覆盖旧版本升级、重新打开、保留关联数据及失败场景。

修改时同时追踪 IndexedDB、localStorage 和原生持久化；不要只检查当前页面状态。FSRS 调度状态与复习日志保持一致，保留事务完成语义、重复提交幂等性和过期候选保护。

不得为修复开发环境问题清除用户书库、应用数据或签名身份。测试使用隔离数据，不使用真实用户数据库。

## Architecture

- 开发前优先检查现有 abstraction 和实际调用链；优先扩展已有架构。
- 不要因为实现新功能就创建与现有系统重复的 repository、store、service 或 state model。
- UI 与业务逻辑保持分离；领域契约、格式解析、持久化和平台能力各自承担明确职责。
- 格式解析优先放在 `src/document-adapters/`，文档契约复用 `src/domain/documents/`；PDF 渲染继续使用现有专用渲染层，不把第三方格式实现散落到无关页面。
- 文档、位置、阅读活动、书签和批注复用 `src/storage/`；学习数据与复习复用 `src/features/learning/repository.ts` 和 `src/features/review/review-service.ts`。
- 平台判断复用 `src/platform/runtime.ts`；文件选择与 Android 返回行为沿用 `src/platform/` 的边界，原生能力通过现有 Tauri 桥接。
- 避免单个文件持续膨胀，按清晰职责提取代码；不要顺带大规模重构或全仓库格式化，也不要为遥远的未来过度工程化。
- 新依赖前检查已有库与能力；依赖及 lockfile 变更应有实际理由，保持原生运行时版本兼容。
- `src-tauri/gen/android/` 包含自定义 Activity 和插件代码，不可将整个目录视为可随意覆盖的生成产物；重新生成前核对并保护这些实现。

## AI & Credentials

- 离线阅读和本地词典不应依赖 AI 配置、网络或服务可用性；模型失败不阻塞继续阅读。
- AI 请求由用户主动触发，只发送所需选词与局部语境，不上传整本书、书库或学习历史。
- 书籍内容视为不可信引用文本，不作为模型指令执行；保持解释简短、贴合当前语境并避免剧透。
- API Key 不进入 localStorage、日志、测试产物或仓库。复用会话凭据与 Windows DPAPI / Android Keystore 安全存储，保留端点绑定与清除行为。
- 保留现有端点校验、平台协议限制、超时、取消、响应大小限制和禁止重定向的边界；不要静默追加收费请求。
- Android 签名材料与密码是私有资产，不提交或分享；保留既有签名身份，以便无损覆盖升级。

## Development Workflow

修改功能前：

1. 检查现有实现、相关测试与适用规范。
2. 找出真实数据流：入口 → 业务逻辑 → 领域契约 → 持久化 / 平台桥接 → UI。
3. 判断 Windows / Android 影响，包括交互与生命周期。
4. 判断数据兼容性、迁移和失败时的行为。
5. 优先复用已有代码，再实施范围明确的改动。

完成后：

1. 运行针对性测试；根据共享层、Reader、持久化或平台影响，必要时运行完整测试及构建检查。
2. 不允许通过删除测试、降低断言或跳过错误来“修复”测试。
3. 只报告实际执行的验证结果；环境缺失、失败和未执行检查应说明，不能推断为通过。
4. 报告修改的文件、完成内容、未完成内容、验证结果、风险和手动验证方式。

现有验证入口（以 `package.json` 和脚本实际配置为准）：

- `npm test -- <相关测试路径>`：针对性 Vitest 测试；`npm test`：完整单元 / 组件测试。
- `npm run typecheck`、`npm run lint`、`npm run build`：类型、静态检查和前端构建。
- `npm run test:browser`：EPUB 分页边界与位置恢复。
- `npm run test:reading-help`：查词、阅读帮助及多格式交互。
- `npm run test:learning-review`：阅读计时、学习状态与轻复习；该脚本使用 preview，先运行 `npm run build`。
- 浏览器脚本使用 Playwright，默认查找 Windows Edge，可通过 `EDGE_PATH` 指定路径；验证前检查对应脚本的环境要求。
- 原生 Rust 改动按范围运行 `cargo test --manifest-path src-tauri/Cargo.toml` 和相应平台构建；Windows 构建入口为 `npm run tauri:build`，Android 为 `npm run build:android`，环境要求参考 `docs/android.md`。
- 仅修改文档时检查内容、路径和 diff，通常无需运行应用测试；不要把未运行的测试写成通过。

## Current Product State

当前项目使用 React + TypeScript + Vite 和 React Router，Tauri 2 / Rust 提供 Windows 与 Android 应用外壳。已有 Home / Continue Reading、Library 本地导入、Reader、阅读帮助、轻复习、阅读统计与设置；仍保留演示数据与原型会话总结，不能将其当成真实用户数据。

主要代码结构与数据流：

- `src/app/` 管理路由、主题与响应式入口，`src/components/ui/`、`src/styles/` 提供共享 UI 和样式。
- Library 经 `src/platform/files/` 选择文件，调用 `src/features/import/` 和 `src/document-adapters/`，再由 `src/storage/` 保存原始 Blob、解析内容与元数据；支持 EPUB、PDF、TXT、DOCX。
- `src/features/reader/` 管理阅读交互；`documents/ImportedDocumentReader.tsx` 处理导入文档与可重排阅读，`PdfDocumentReader.tsx` 处理 PDF 原版 / 阅读视图；已有目录、搜索、EPUB 内部链接 / 脚注、书签、批注和设置。格式能力由实际解析结果决定，扫描 PDF 无 OCR。
- `src/domain/` 保存文档、位置、书签、批注等契约；`src/storage/` 的 `lumaread-documents` IndexedDB 保存文档、位置、阅读活动、书签和批注，并有历史记录升级逻辑。
- Vocabulary / Dictionary 的真实学习数据主要在 `src/features/learning/`：读取 `public/dictionary/` 中的 ECDICT 离线分片，保存查词、词汇状态和阅读会话；`src/features/review/` 使用 `ts-fsrs` 调度显式加入学习的词汇。`lumaread-learning` IndexedDB 保存学习数据、FSRS 卡片与复习日志；设置另有 localStorage 持久化。
- AI provider 位于 `src/features/learning/context-provider.ts`，支持兼容 Chat Completions 的服务与 Ollama；浏览器使用 fetch，原生应用通过 Tauri 命令。`src-tauri/src/reading_context.rs`、`reading_credentials.rs`、`reading_speech.rs` 处理原生网络、凭据和发音，Android 经 `mobile_reading.rs` 委托 Kotlin 插件。
- Windows 原生能力包含 DPAPI 与系统语音；Android 的 `src-tauri/gen/android/app/src/main/java/com/lumaread/reader/` 包含 `MainActivity.kt` 和 `ReadingMobilePlugin.kt`，处理系统 / 键盘 inset、Keystore、模型请求和离线 TTS。前端 Android 返回逻辑在 `src/platform/`。
- 测试主要与源码同目录，使用 Vitest、jsdom 与 fake-indexeddb；`tests/browser/` 是 Playwright 场景脚本，`docs/qa/` 保存已有验证记录。历史产品与架构文档在 `docs/`，其阶段性设计可能落后于当前代码，应核实后引用。
