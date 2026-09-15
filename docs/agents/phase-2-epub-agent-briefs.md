# LumaRead Phase 2 Agent Briefs

共同基线：`phase1-ui-prototype` / `6f48ef6`  
集成分支：`phase2/epub-reader`

以下任务默认串行交付。每一步完成后先审查、集成，再向下一 Agent 提供新的基础提交。

## 1. EPUB Foundation Agent

```text
目标：建立 Phase 2 EPUB 所需依赖、公共契约、会话 Registry 与 Library 路由占位。

开始前完整阅读：
- docs/product/phase-2-epub-reader.md
- docs/architecture/epub-reader-boundaries.md

分支：feat/epub-foundation
基础提交：由 Integration Agent 指定的 phase2/epub-reader HEAD

允许修改：
- package.json、package-lock.json
- src/domain/**
- src/app/providers/**
- src/app/routes/**
- src/features/library/index.tsx（仅最小占位）

必须完成：
- 安装并锁定 epub.js 所需依赖；
- 定义不泄漏 epub.js 类型的 Publication、TOC、Locator、状态与错误契约；
- 建立会话内 ImportedBook Provider/Registry；
- 新增 /library 路由和稳定 LibraryPage 导出；
- 保持现有四条路由与 App 结构；
- 不实现真实 Reader UI 或复杂 Library UI。

禁止：
- IndexedDB；
- 词典、AI、FSRS；
- 修改 Home、Reader、Review 页面；
- 使用 latest；
- 过度抽象远程存储或多 Provider。

验证：typecheck、零警告 lint、build、四条旧路由与 /library、git diff --check。
提交建议：feat: establish epub reader foundation
```

## 2. EPUB Engine Agent

```text
目标：把 epub.js 封装为可销毁、可订阅、UI 无关的 EPUB adapter。

开始前完整阅读 Phase 2 产品与架构文档。

分支：feat/epub-engine
基础提交：Foundation 已集成后的 phase2/epub-reader HEAD

只允许修改：
- src/features/reader/epub/**
- 经批准的 tests/epub/**

必须完成：
- ArrayBuffer EPUB 加载；
- metadata、cover、TOC、spine 读取；
- mount/display/prev/next；
- relocation、rendered、contents、selection 事件转发；
- Light/Dark 与字号注入；
- 统一错误映射；
- destroy、取消订阅、Blob URL 回收；
- Strict Mode 重复生命周期安全。

禁止：
- 修改 ReaderPage；
- 创建 Library UI；
- 直接写业务 Mock；
- 实现词典或分词；
- 新增未经 Foundation Agent 批准的依赖。

至少验证：有效 EPUB、缺封面 EPUB、损坏文件、重复 destroy。
提交建议：feat: add epub rendering engine
```

## 3. Import Experience Agent

```text
目标：完成轻量 Library / Open EPUB 导入体验，并把有效书籍放入会话 Registry。

分支：feat/epub-import
基础提交：EPUB Engine 已集成后的 phase2/epub-reader HEAD

允许修改：
- src/features/library/**
- src/features/home/HomeNavigation.tsx
- src/features/home/MobileHomeChrome.tsx

必须完成：
- Open EPUB 文件选择器；
- 文件类型、空文件和解析错误提示；
- 导入中状态；
- metadata 与封面预览；
- 无封面回退；
- 当前会话最近导入列表；
- 导入成功后进入 /reader/:bookId；
- 明确“文件只在本地处理，刷新后可能需要重新选择”；
- Home 中 Library 入口变为真实链接；
- Desktop/Mobile/Light/Dark。

禁止：
- IndexedDB；
- 上传文件；
- 完整书库管理；
- 修改 Reader 引擎和公共契约；
- 修改 Quick Review 或 Session Summary。

验证：取消文件选择、非法扩展名、损坏 EPUB、有效 EPUB、缺封面 EPUB。
提交建议：feat: add local epub import experience
```

## 4. Reader Integration Agent

```text
目标：让 /reader/:bookId 同时支持 Phase 1 Mock 示例书和真实会话 EPUB。

分支：feat/epub-reader-ui
基础提交：Import Experience 已集成后的 phase2/epub-reader HEAD

允许修改：
- src/features/reader/**

必须完成：
- ReaderPage 重构为协调器；
- 保持稳定 ReaderPage 导出和路由；
- MockReaderView 保留现有词典与句子解释；
- EpubReaderView 使用已完成的 EPUB adapter；
- 动态书名、章节与进度；
- 上一页、下一页、目录跳转；
- Desktop 目录侧卡/Popover，Mobile 目录 Bottom Sheet；
- 主题和字号同步至 EPUB iframe；
- resize/orientation 后正确重新布局；
- 工具栏静置淡出；
- 源丢失恢复页；
- loading、empty、unsupported、render error 状态；
- 卸载和切书时完整清理引擎。

禁止：
- 对 EPUB 实现点词查词；
- 把 Mock 词典绑定到真实 EPUB；
- IndexedDB、AI、FSRS；
- 修改公共契约或依赖。

验证视口：390×844、768×1024、834×1112、1024×768、1440×900。
提交建议：feat: integrate real epub reading experience
```

## 5. EPUB QA Agent

```text
目标：只读验收 Phase 2；不修改产品实现。

基础提交：Reader Integration 已集成后的 phase2/epub-reader HEAD

必须使用：
- 至少一本带封面的可重排 EPUB；
- 至少一本无封面 EPUB；
- 一个损坏或伪造的 .epub 文件。

检查：
- 导入、取消、错误恢复；
- metadata、cover、TOC、正文；
- prev/next、目录跳转、章节和进度；
- Light/Dark、字号；
- 390/834/1440 重点视口及 768/1024 边界；
- 刷新后的 source-missing 恢复页；
- Mock Reader 回归；
- Strict Mode 下无重复 iframe；
- 切书后无旧事件、旧封面 URL 或控制台错误；
- typecheck、零警告 lint、build、git diff --check。

按 P0/P1/P2/P3 报告。没有 P0/P1 时才能建议 Phase 2 签收。
```

## 6. Agent 交付格式

```text
分支：
基础提交：
最终提交：

修改文件：
- ...

已完成：
- ...

明确未完成：
- ...

验证：
- 命令 / 场景：结果

已知问题：
- ...

需要 Integration Agent 处理：
- ...
```

