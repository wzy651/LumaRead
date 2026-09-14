# Foundation Agent 任务书

任务编号：P1-F01  
任务名称：建立 Phase 1 UI Prototype 工程地基  
执行方式：单 Agent 串行执行  
前置条件：空目录或未经初始化的项目目录

## 1. 角色

你是 LumaRead Phase 1 的 Foundation / Integration Agent。你的任务是建立一个稳定、简单、可供多个 Feature Agent 并行工作的前端基础工程。

你不是产品设计 Agent。不得改变 `docs/product/phase-1-ui-prototype.md` 中已经确定的产品方向。

## 2. 开始前必须阅读

1. `docs/product/phase-1-ui-prototype.md`
2. `docs/architecture/frontend-boundaries.md`
3. 项目中已有的其他说明文件

如果文件之间存在冲突，停止扩大实现范围，只报告冲突。

## 3. 目标

建立 React + TypeScript + Vite 的基础项目，并提供：

- 可启动、可构建的应用；
- 清晰的模块目录；
- 基础路由；
- Light / Dark 主题；
- 响应式设计变量；
- 公共领域类型；
- Mock 数据契约；
- 最小公共 UI 组件；
- 为 Home、Reader、Review 三个 Agent 准备的稳定接口。

## 4. 必须完成

### 4.1 工程基础

- 初始化 React、TypeScript、Vite；
- 配置开发、构建、类型检查和代码检查命令；
- 添加合理的 `.gitignore`；
- 建立应用入口；
- 确认开发服务器可以启动；
- 确认生产构建可以完成。

### 4.2 应用结构

至少建立：

```text
src/app
src/components/ui
src/domain
src/features/home
src/features/reader
src/features/review
src/features/session-summary
src/mocks
src/styles
tests
```

功能目录只创建稳定入口或最小占位，不实现具体页面视觉。

### 4.3 路由

建立以下路由契约：

```text
/
/reader/:bookId
/review
/session-summary
```

可以使用最小占位页面验证路由，但不得提前替 Feature Agent 完成页面。

### 4.4 主题与设计变量

按照产品规格建立：

- Light / Dark 色彩变量；
- 字体栈；
- 间距变量；
- 圆角变量；
- 动效时长和 easing；
- Mobile、Tablet、Desktop 断点策略；
- 全局正文与可访问性基础样式。

主题切换必须可操作。主题状态暂时可以使用浏览器本地能力保存，但不得建立复杂设置系统。

### 4.5 公共类型

建立最小、明确的领域类型，至少覆盖：

- Book；
- ReadingProgress；
- ReadingSession；
- VocabularyItem；
- VocabularyStatus；
- LookupEvent；
- ReviewItem。

类型需要支持 Phase 1 Mock UI，但不要提前设计完整数据库 schema。

### 4.6 Mock 契约

提供可供 Feature Agent 引用的 Mock 数据入口，至少定义：

- books；
- currentBook；
- vocabularyItems；
- reviewItems；
- sessionSummary。

Mock 数据应与公共类型一致。不得接入真实网络请求。

### 4.7 最小公共 UI

只建立确实会被多个页面复用的基础组件，例如：

- Button；
- IconButton；
- Card；
- Progress；
- ThemeToggle。

不建立庞大的内部组件库，不实现 Feature 专属组件。

## 5. 明确不做

- 不实现完整 Home；
- 不实现完整 Reader；
- 不实现 Popover 或 Bottom Sheet 的最终产品样式；
- 不实现 Quick Review 或 Session Summary；
- 不实现 EPUB、词典、AI、IndexedDB、FSRS；
- 不建立用户系统；
- 不添加商业分析与埋点；
- 不引入大型状态管理框架，除非存在当前阶段无法用 React 基础能力解决的明确问题；
- 不为未来原生 App 构建跨平台框架。

## 6. 实现约束

- 组件化，但不过度抽象；
- 公共组件 API 必须小且稳定；
- 页面不得包含大量散落硬编码；
- 响应式优先使用 CSS；
- 不使用 `window.innerWidth` 作为布局系统；
- 核心交互不得只依赖 hover；
- 新依赖必须说明必要性；
- 避免引入完整 UI 框架覆盖既定视觉语言；
- 图标使用 Lucide；
- 保持严格 TypeScript 类型。

## 7. 建议但不强制的技术选择

- React
- TypeScript
- Vite
- React Router
- Lucide React
- CSS Modules 或结构清晰的普通 CSS

如果选择其他方案，必须说明它如何更好地满足当前规格，并避免扩大项目复杂度。

## 8. 验收标准

- 开发服务器正常启动；
- 四个路由均可访问；
- 路由之间可以进行最小导航；
- Light / Dark 可以切换；
- 刷新后主题行为合理；
- 公共类型与 Mock 数据无 TypeScript 错误；
- 页面在 390px、834px、1440px 宽度下无基础横向溢出；
- 类型检查通过；
- 代码检查通过；
- 生产构建通过；
- 浏览器控制台无未处理错误；
- 未实现明确排除的业务功能。

## 9. 完成后的交付报告

请严格报告：

```text
分支：
基础提交：
最终提交：

技术选择：
- ...

修改文件：
- ...

已完成：
- ...

明确未完成：
- ...

验证结果：
- dev：
- typecheck：
- lint：
- build：

供后续 Agent 使用的公共接口：
- ...

已知问题：
- ...
```

完成后不要自行启动 Home、Reader 或 Review 的后续开发，等待 Integration / Product Agent 确认基础接口。

