# LumaRead 前端边界与多 Agent 协作规则

状态：Draft v0.1  
适用阶段：Phase 1 UI Prototype

## 1. 基本原则

1. 按产品模块分工，不按设备分工。
2. 每个功能 Agent 同时负责 Desktop、Tablet 和 Mobile。
3. 多个 Agent 不共享同一个工作目录，必须使用独立 Git worktree。
4. 只有 Integration Agent 可以修改主分支、应用入口和公共契约。
5. Feature Agent 默认只能修改自己拥有的目录。
6. 公共依赖、lockfile、路由、主题和跨模块类型必须串行修改。
7. UI 与业务状态分离；Mock 服务未来可以被真实实现替换。
8. 优先使用简单明确的组件边界，不为未来能力建立复杂框架。

## 2. 建议目录

```text
src/
├─ app/
│  ├─ routes/
│  ├─ providers/
│  └─ App.tsx
├─ components/
│  └─ ui/
├─ domain/
│  ├─ book.ts
│  ├─ reading.ts
│  ├─ vocabulary.ts
│  └─ review.ts
├─ features/
│  ├─ home/
│  ├─ reader/
│  ├─ review/
│  └─ session-summary/
├─ mocks/
└─ styles/
tests/
└─ e2e/
docs/
├─ product/
├─ architecture/
└─ agents/
```

## 3. 文件所有权

### Integration Agent

独占维护：

- `package.json`
- 依赖 lockfile
- 构建、TypeScript、Lint 与测试配置
- `src/app/**`
- `src/components/ui/**`
- `src/domain/**`
- `src/styles/**`
- 跨功能 Mock 数据契约

### Home Agent

默认只修改：

- `src/features/home/**`

### Reader Agent

默认只修改：

- `src/features/reader/**`

### Review Agent

默认只修改：

- `src/features/review/**`
- `src/features/session-summary/**`

### QA Agent

默认只修改：

- `tests/**`
- QA 报告文件

QA 发现产品实现问题时，优先将问题退回原 Feature Agent，不直接跨目录重构。

## 4. 公共文件变更协议

Feature Agent 如果发现公共能力缺失，应提交一个简短请求，包含：

1. 需要修改的公共文件；
2. 当前功能为什么需要；
3. 建议的最小接口；
4. 如果不修改会产生什么问题；
5. 是否存在模块内临时方案。

Integration Agent 决定：

- 在公共层补充能力；
- 允许 Feature Agent 修改指定文件；
- 暂时保留为模块内部能力。

未经允许，Feature Agent 不得直接调整公共组件 API。

## 5. 响应式架构

同一个功能应共享：

- 数据类型；
- 状态逻辑；
- 文本内容；
- 用户操作语义；
- Mock 服务接口。

只有设备交互明显不同时才拆分呈现组件。例如：

```text
Dictionary lookup state
├─ DictionaryContent          共享内容
├─ DictionaryPopover          Desktop 呈现
├─ DictionaryBottomSheet      Mobile 呈现
└─ AdaptiveDictionary         选择呈现方式
```

布局变化优先使用 CSS 媒体查询。只有 Popover / Bottom Sheet、键盘 / 触摸等行为差异才使用 JavaScript 媒体查询。

禁止：

- 建立两套独立业务页面并复制状态逻辑；
- 在多个组件中直接读取 `window.innerWidth`；
- 让核心操作依赖 hover；
- 用隐藏重要内容的方式完成窄屏适配；
- 把 Mobile 适配留到功能完成以后。

## 6. Git Worktree 规范

所有工作分支必须从同一个已确认的基础提交创建。

建议命名：

```text
feat/foundation
feat/home
feat/reader
feat/review
test/ui-qa
```

建议工作目录：

```text
LumaRead
LumaRead-home
LumaRead-reader
LumaRead-review
LumaRead-qa
```

规则：

- 每个 Agent 使用独立 worktree；
- 每个 Agent 只提交自己的分支；
- 只有 Integration Agent 合并到主分支；
- 不允许 Feature Agent 自行 rebase 或 force push 集成分支；
- 不允许跨 worktree 复制未提交文件；
- 不执行无关的全仓库格式化；
- 每个提交应保持单一目的；
- 合并前必须记录验证命令与结果。

## 7. 依赖管理

- Feature Agent 不自行安装新依赖；
- 需要新依赖时先向 Integration Agent 提出请求；
- Integration Agent 统一修改 `package.json` 和 lockfile；
- 已选定能力优先使用成熟库；
- Phase 1 不安装 EPUB、FSRS、数据库或 AI SDK；
- 不为了一个简单 UI 组件引入大型组件框架。

## 8. Agent 交付格式

每个实现 Agent 完成后必须报告：

```text
分支：
基础提交：
最终提交：

修改文件：
- ...

已完成：
- ...

未完成：
- ...

验证：
- 命令：结果

已知问题：
- ...

需要 Integration Agent 处理：
- ...
```

## 9. 合并顺序

建议顺序：

1. Foundation
2. Home
3. Reader
4. Review / Session Summary
5. QA 测试
6. 集成修复

Home、Reader、Review 可以在 Foundation 合并后并行开发，但最终由 Integration Agent 串行合并。

## 10. 冲突预防清单

开始任务前确认：

- Agent 是否拥有独立 worktree；
- Agent 是否从指定基础提交开始；
- 允许修改的目录是否明确；
- 禁止修改的文件是否明确；
- 接口是否已经冻结；
- 验收视口是否明确；
- 是否禁止新增依赖；
- 是否说明了明确不做的功能。

完成任务前确认：

- 没有修改越界文件；
- 没有无关格式化；
- 没有提交构建产物；
- 没有引入未经批准的依赖；
- 三类设备均已检查；
- Light / Dark 均已检查；
- 已留下清晰交付报告。

