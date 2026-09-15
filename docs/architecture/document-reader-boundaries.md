# LumaRead 多格式 Document Reader 架构边界

状态：Phase 2 implementation contract v0.2  
基础提交：`6f48ef6`

## 1. 核心原则

Reader 页面只依赖 LumaRead 自己的文档契约。`epub.js`、PDF.js 和 Mammoth 必须被限制在格式 adapter 内，不能散落到页面组件。

PDF 是固定页面；EPUB、DOCX、TXT 是可重排内容。共享导入、状态和控制语义，但不强行共享渲染实现。

## 2. 总体结构

```text
Library UI
  → format detector
  → format adapter.inspect(ArrayBuffer)
  → ImportedDocument session registry
  → /reader/:documentId
  → ReaderPage coordinator
      ├─ MockReaderView
      ├─ ReflowReaderView
      │    ├─ EpubAdapter
      │    ├─ DocxAdapter
      │    └─ TextAdapter
      └─ PdfReaderView
           └─ PdfAdapter
```

## 3. 技术选择

- EPUB：`epub.js`；
- PDF：`pdfjs-dist`，使用 Display API 与本地 worker；
- DOCX：Mammoth 浏览器 API，将 ArrayBuffer 转换为语义 HTML；
- DOCX HTML 清理：DOMPurify；
- TXT：浏览器 `TextDecoder`；
- 文件数据：会话内 Provider / Registry。

依赖必须固定版本，由 Foundation Agent 统一写入 package 与 lockfile。

## 4. 公共领域契约

```ts
type DocumentFormat = 'demo' | 'epub' | 'pdf' | 'docx' | 'txt'
type DocumentLayout = 'reflow' | 'fixed-page'

interface DocumentMetadata {
  id: string
  format: DocumentFormat
  layout: DocumentLayout
  fileName: string
  title: string
  author?: string
  coverUrl?: string
  pageCount?: number
}

interface DocumentCapabilities {
  tableOfContents: boolean
  paginated: boolean
  zoom: boolean
  textSelection: boolean
}

interface DocumentLocator {
  documentId: string
  href?: string
  cfi?: string
  pageNumber?: number
  blockId?: string
  label?: string
  completedPercent?: number
}

type DocumentReaderStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'error'
  | 'source-missing'
```

公共类型不得暴露 epub.js、PDF.js 或 Mammoth 类型。

## 5. Adapter 契约

每种格式实现自己的 adapter，但向协调器提供统一生命周期：

```ts
interface DocumentAdapter {
  inspect(source: ArrayBuffer, fileName: string): Promise<DocumentMetadata>
  mount(target: HTMLElement, source: ArrayBuffer): Promise<void>
  display(locator?: DocumentLocator): Promise<void>
  previous(): Promise<void>
  next(): Promise<void>
  getCapabilities(): DocumentCapabilities
  subscribe(listener: DocumentReaderListener): () => void
  destroy(): void
}
```

格式不支持的能力由 capabilities 声明，UI 不使用异常做能力判断。

## 6. Adapter 所有权

```text
src/features/reader/adapters/
├─ epub/**
├─ pdf/**
├─ docx/**
└─ text/**
```

### EPUB

- metadata、cover、navigation、spine；
- rendition 与主题；
- CFI、relocation、contents 事件；
- 禁用 scripted content；
- destroy book/rendition/Blob URL。

### PDF

- 从 Uint8Array / ArrayBuffer 加载；
- PDF worker 配置；
- page render task 取消；
- canvas 与 text layer；
- 页数、当前页、缩放；
- destroy loading task/document/worker 资源。

### DOCX

- Mammoth `arrayBuffer` 输入；
- 转换消息映射为非阻断警告；
- 输出 HTML 必须经 DOMPurify；
- 外部文件访问保持禁用；
- 图片 URL / data URI 生命周期明确；
- 不承诺页面布局还原。

### TXT

- 解码与 BOM 处理；
- 空行和段落标准化；
- 转义为文本节点，禁止把 TXT 当 HTML 注入；
- 大文本分块，避免一次创建极大 DOM。

## 7. Reader 组件边界

```text
ReaderPage
├─ source resolver
├─ MockReaderView
├─ ReflowReaderView
└─ PdfReaderView
```

- 保持 `ReaderPage` 正式导出；
- 保持 `/reader/:documentId`；
- Mock Reader 保留查词演示；
- 真实文档不显示 Mock Dictionary；
- 通用 chrome 可共享；
- PDF 专属页码/缩放不能泄漏到 reflow UI；
- reflow 字号与 PDF zoom 是不同状态。

## 8. Session Registry

Registry 保存：

```text
documentId
metadata
original ArrayBuffer
current locator
session timestamps
```

Registry 不负责持久化。刷新后找不到 source 时返回 `source-missing`，不能重定向到示例书。

ArrayBuffer 与 parser 实例不得放入 React Router location state 或 localStorage。

## 9. 安全边界

- Mammoth 官方明确不负责清理输出 HTML，因此 DOMPurify 是强制边界；
- 不使用 `dangerouslySetInnerHTML` 注入未清理内容；
- PDF worker 从本地 bundle 加载；
- EPUB 不开启 `allowScriptedContent`；
- 外部链接统一由 Reader 层拦截并使用安全打开策略；
- 切书时先取消订阅，再销毁 adapter。

## 10. 多 Agent 文件所有权

### Foundation Agent

- package、lockfile；
- `src/domain/**`；
- `src/app/providers/**`；
- `src/app/routes/**`；
- `src/features/library/index.tsx` 最小占位。

### EPUB Adapter Agent

- `src/features/reader/adapters/epub/**`；
- `tests/document/epub/**`。

### PDF Adapter Agent

- `src/features/reader/adapters/pdf/**`；
- `tests/document/pdf/**`。

### DOCX/TXT Adapter Agent

- `src/features/reader/adapters/docx/**`；
- `src/features/reader/adapters/text/**`；
- `tests/document/reflow/**`。

### Import Experience Agent

- `src/features/library/**`；
- 经明确授权的 Home Library 入口文件。

### Reader Integration Agent

- `src/features/reader/**`，但不能修改 adapter 内部实现或公共契约。

## 11. 集成顺序

1. Foundation；
2. EPUB、PDF、DOCX/TXT adapters 可并行；
3. Integration Agent 串行合并三个 adapter；
4. Library import experience；
5. Reader integration；
6. QA；
7. 最终集成修复。

所有 Agent 使用独立 worktree。禁止复制未提交文件、force push、跨模块格式化或自行修改依赖。

