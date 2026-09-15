# LumaRead Phase 2 多格式文档 Agent Briefs

Phase 1 基线：`phase1-ui-prototype` / `6f48ef6`  
集成分支：`phase2/document-reader`

所有 Agent 开始前必须阅读：

- `docs/product/phase-2-local-document-reader.md`
- `docs/architecture/document-reader-boundaries.md`

## 1. Document Foundation Agent

```text
目标：建立 EPUB、PDF、DOCX、TXT 的依赖、公共契约、会话 Registry 与 /library 占位。

分支：feat/document-foundation
基础提交：由 Integration Agent 指定的 phase2/document-reader HEAD

允许修改：package.json、lockfile、src/domain/**、src/app/providers/**、src/app/routes/**、src/features/library/index.tsx。

必须完成：
- 固定版本安装 epub.js、pdfjs-dist、mammoth、dompurify 及必要类型；
- 定义 DocumentFormat、Layout、Metadata、Capabilities、Locator、Error；
- 建立会话内 ImportedDocument Registry；
- 添加 /library 和稳定 LibraryPage 占位导出；
- 保持旧路由全部可用。

禁止：Reader UI、复杂 Library UI、IndexedDB、AI、词典、FSRS、latest 依赖。

验证：typecheck、零警告 lint、build、旧路由与 /library、git diff --check。
提交：feat: establish local document foundation
```

## 2. EPUB Adapter Agent

```text
分支：feat/document-epub-adapter
基础提交：Foundation 集成后的 HEAD
只修改：src/features/reader/adapters/epub/**、tests/document/epub/**。

实现 metadata、cover、TOC、spine、rendition、display、prev/next、theme、font scale、relocation、contents/selection 事件和完整 destroy。保持 scripted content 禁用。

不修改 ReaderPage、Library、公共类型或依赖。
验证有效 EPUB、无封面 EPUB、损坏 EPUB、重复 destroy 和 Strict Mode 生命周期。
提交：feat: add epub document adapter
```

## 3. PDF Adapter Agent

```text
分支：feat/document-pdf-adapter
基础提交：Foundation 集成后的同一 HEAD，可与其他 adapter 并行。
只修改：src/features/reader/adapters/pdf/**、tests/document/pdf/**。

实现本地 PDF 加载、本地 worker、metadata/pageCount、页面 canvas、text layer、页码、prev/next、zoom、render task 取消和 destroy。

不嵌入 PDF.js 默认完整 Viewer，不修改 ReaderPage、Library、公共类型或依赖。
验证文本 PDF、损坏 PDF、密码 PDF、快速切页取消、HiDPI 与 resize。
提交：feat: add pdf document adapter
```

## 4. DOCX/TXT Adapter Agent

```text
分支：feat/document-reflow-adapters
基础提交：Foundation 集成后的同一 HEAD，可与 EPUB/PDF adapter 并行。
只修改：src/features/reader/adapters/docx/**、src/features/reader/adapters/text/**、tests/document/reflow/**。

DOCX：使用 Mammoth 浏览器 ArrayBuffer API，保留语义结构，收集转换警告，并用 DOMPurify 清理全部 HTML。
TXT：安全解码、BOM 处理、段落组织、文本节点输出和大文件分块。

不支持 .doc，不使用未清理 innerHTML，不修改 ReaderPage、Library、公共类型或依赖。
验证普通 DOCX、含图片/表格 DOCX、损坏 DOCX、UTF-8 TXT、空 TXT、大 TXT。
提交：feat: add docx and text adapters
```

## 5. Import Experience Agent

```text
分支：feat/document-import
基础提交：三个 adapter 全部集成后的 HEAD

允许修改：src/features/library/**，以及明确授权的 src/features/home/HomeNavigation.tsx、MobileHomeChrome.tsx。

实现 Open document、格式识别、accept 限制、导入/错误状态、metadata/cover 回退、会话最近打开列表、进入 /reader/:documentId、本地处理和刷新限制说明，并启用 Home 的 Library 入口。

不得修改 adapters、Reader、公共契约或依赖。
验证 EPUB/PDF/DOCX/TXT、取消选择、伪扩展名、损坏文件、.doc 提示和双端主题。
提交：feat: add local document import experience
```

## 6. Reader Integration Agent

```text
分支：feat/document-reader-ui
基础提交：Import Experience 集成后的 HEAD
允许修改：src/features/reader/**，但 adapter 目录只允许接线，不得重写内部实现。

把 ReaderPage 拆为协调器、MockReaderView、ReflowReaderView、PdfReaderView。接入动态标题/位置/进度、EPUB 目录与翻页、DOCX/TXT 可重排阅读、PDF 页码/缩放/text layer、两类移动端控制、主题、字号、工具栏淡出、source-missing 和错误恢复。

真实文档不得使用 Mock Dictionary；不得实现 IndexedDB、AI、词典或 FSRS。

验证 390×844、768×1024、834×1112、1024×768、1440×900，以及 Mock Reader 回归。
提交：feat: integrate multi-format reading experience
```

## 7. Document QA Agent

```text
只读验收，不修改实现。

样本：带封面 EPUB、无封面 EPUB、文本 PDF、密码或损坏 PDF、普通 DOCX、含表格/图片 DOCX、UTF-8 TXT、损坏文件、旧 .doc。

检查导入、错误恢复、两种阅读模式、翻页/目录/页码/缩放、主题、字号、响应式、source-missing、Mock Reader 回归、资源销毁和控制台错误。

运行 typecheck、零警告 lint、build、git diff --check。按 P0/P1/P2/P3 报告；没有 P0/P1 才能建议签收。
```

## 8. 统一交付格式

```text
分支：
基础提交：
最终提交：
修改文件：
已完成：
明确未完成：
验证：
已知问题：
需要 Integration Agent 处理：
```

