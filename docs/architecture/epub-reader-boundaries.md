# LumaRead EPUB Reader 架构边界

状态：Phase 2 implementation contract v0.1  
基础提交：`6f48ef6`

## 1. 设计目标

把 `epub.js` 限制在明确的适配器边界内，使 Reader 页面依赖稳定的 LumaRead 接口，而不是散落调用第三方 API。

本阶段采用会话内数据，不建立 IndexedDB 抽象。

## 2. 建议层次

```text
Library UI
  → EPUB import service
  → ImportedBook session registry
  → /reader/:bookId
  → ReaderPage coordinator
      ├─ MockReaderView
      └─ EpubReaderView
           → EpubReaderEngine adapter
               → epub.js
```

### UI 层

负责：

- 文件选择；
- 加载、错误和恢复状态；
- Reader chrome；
- 目录、翻页和进度展示；
- 响应式布局。

不直接调用 `epub.js` 内部对象。

### EPUB adapter

负责：

- 创建、加载和销毁 EPUB 实例；
- metadata、cover、navigation 与 spine 解析；
- rendition 创建；
- display、prev、next；
- theme 与字号同步；
- relocation、rendered、contents、selection 等事件转发；
- 第三方错误转换为稳定的 LumaRead 错误。

### Session registry

负责：

- 当前标签页内的导入书籍；
- `bookId → metadata + ArrayBuffer + current locator`；
- 为 Library 与 Reader 提供同一份会话状态；
- 在 Provider 卸载时释放持有的资源。

不负责永久保存。

## 3. 公共数据契约

公共领域对象应保持简单、可测试，不能暴露 `Book`、`Rendition`、`Contents` 等 epub.js 类型。

建议最小契约：

```ts
type PublicationFormat = 'demo' | 'epub'

interface PublicationMetadata {
  id: string
  format: PublicationFormat
  title: string
  author: string
  coverUrl?: string
}

interface TableOfContentsItem {
  id: string
  href: string
  label: string
  children?: TableOfContentsItem[]
}

interface ReadingLocator {
  bookId: string
  cfi?: string
  href?: string
  chapterLabel?: string
  completedPercent?: number
}

type EpubReaderStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'error'
  | 'source-missing'
```

具体命名可以由 Foundation Agent 微调，但语义和边界不得扩大。

## 4. EPUB 引擎接口

建议 Reader 只依赖类似接口：

```ts
interface EpubReaderEngine {
  inspect(source: ArrayBuffer): Promise<PublicationMetadata>
  mount(target: HTMLElement, source: ArrayBuffer): Promise<void>
  display(target?: string): Promise<void>
  prev(): Promise<void>
  next(): Promise<void>
  setTheme(theme: 'light' | 'dark'): void
  setFontScale(scale: number): void
  getTableOfContents(): TableOfContentsItem[]
  subscribe(listener: EpubReaderListener): () => void
  destroy(): void
}
```

不要求逐字照搬，但必须满足：

- UI 不导入 epub.js 类型；
- 生命周期只有一个明确所有者；
- 订阅返回取消函数；
- `destroy()` 可以重复调用而不报错；
- Blob URL 的所有权明确。

## 5. 文件所有权

### EPUB Foundation Agent

可修改：

- `package.json`
- lockfile
- `src/domain/**`
- `src/app/providers/**`
- `src/app/routes/**`
- `src/features/library/index.tsx`，仅允许最小占位入口

### EPUB Engine Agent

只修改：

- `src/features/reader/epub/**`
- 经批准的 `tests/epub/**`

### Import Experience Agent

可修改：

- `src/features/library/**`
- `src/features/home/HomeNavigation.tsx`
- `src/features/home/MobileHomeChrome.tsx`
- Library 所需 CSS

不得修改 Reader 引擎。

### Reader Integration Agent

可修改：

- `src/features/reader/**`，但不得重新定义已冻结的公共契约

### QA Agent

只读实现文件；测试产物只能写入 `tests/**` 或项目外临时目录。

## 6. Reader 重构约束

当前 `ReaderPage` 同时包含 Mock 数据、页面壳和交互状态。Phase 2 应拆成协调器与两种内容实现：

```text
ReaderPage
├─ 解析 bookId 与 source kind
├─ MockReaderView
└─ EpubReaderView
```

要求：

- 保持正式导出名 `ReaderPage`；
- 保持 `/reader/:bookId`；
- Mock 示例书仍可使用词典和句子解释；
- EPUB 内容不渲染 Mock 单词按钮；
- 找不到导入源时显示恢复状态，不重定向到 Mock 书；
- 共用 Reader chrome 时避免复制主题、字号和响应式状态。

## 7. iframe 与未来点词

epub.js 通常在 iframe 中渲染内容。Phase 2 必须在 adapter 内集中处理 contents 生命周期，并暴露稳定事件，避免 Phase 3 再次重写 Reader。

Phase 2 允许：

- 为 contents document 注入阅读主题 CSS；
- 监听 selection 但只转发数据；
- 暴露坐标与 CFI 定位信息。

Phase 2 禁止：

- 实现分词；
- 给所有单词包裹 DOM；
- 写入词汇数据库；
- 添加大面积词汇高亮。

## 8. 生命周期清单

每次加载或切换书籍：

1. 取消旧订阅；
2. 销毁旧 rendition；
3. 销毁旧 EPUB book；
4. 撤销旧 cover Blob URL；
5. 加载新源；
6. 创建 rendition；
7. 注册 relocation / rendered / contents 事件；
8. 应用主题和字号；
9. 显示 locator 或第一章。

React Strict Mode 下重复 mount/unmount 不得产生重复 iframe 或事件监听。

## 9. Git 与集成顺序

Phase 2 的 EPUB 能力耦合度较高，默认串行集成：

1. Foundation / contracts；
2. EPUB engine；
3. Library import experience；
4. Reader integration；
5. QA；
6. Integration fixes。

每个 Agent 使用独立 worktree 和分支。后一个 Agent 必须从前一个已经集成的提交开始，禁止复制未提交文件。

