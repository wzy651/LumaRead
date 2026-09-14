# LumaRead Phase 1：UI Prototype 产品规格

状态：Draft v0.1  
用途：作为 Phase 1 所有设计、开发与验收工作的共同产品基线。  
范围：只定义 UI Prototype，不包含真实内容解析、真实词典、AI、数据库或复习算法。

## 1. 产品目标

LumaRead 是一个以沉浸式英文阅读为核心的个人英语学习软件。Phase 1 的目标不是验证完整学习系统，而是验证：

1. 用户打开产品后是否自然地想继续阅读；
2. 查词和理解辅助是否足够快速、克制；
3. Desktop 与 Mobile 是否使用同一套产品语言，同时拥有适合各自设备的交互；
4. 后续 EPUB、词典、Vocabulary、FSRS 与 AI 能否在不推翻 UI 结构的前提下接入。

核心优先级固定为：

> 阅读 > 理解 > 学习 > 数据

## 2. 不可违背的产品原则

- 首页第一视觉重点必须是 Continue Reading。
- 阅读页不得出现常驻侧边栏、大面积词汇高亮或显眼的学习任务。
- 查词只代表即时理解，不自动加入学习。
- 系统可以记录 Mock 查询行为，但不能向用户制造“查了就要背”的压力。
- Quick Review 是可选的轻复习，目标时长约 3 分钟。
- Session Summary 中 Done 必须比 Review 更自然、更突出。
- 不展示金币、XP、排行榜、连续签到或强制任务。
- 默认解释短小；详细内容只在用户主动请求 Explain More 后出现。
- Desktop 与 Mobile 必须在同一功能任务中完成，不能先完成桌面版再补手机。

## 3. Phase 1 范围

### 3.1 必须实现的页面

1. Home
2. Reader
3. Quick Review
4. Session Summary

每个页面必须覆盖：

- Mobile：小于 768px
- Tablet / small laptop：768px–1024px
- Desktop：大于 1024px
- Light Mode
- Dark Mode

### 3.2 必须实现的交互

- 页面基本导航；
- Continue Reading 进入 Reader；
- Reader 中点击指定 Mock 单词；
- Desktop 显示 Floating Dictionary Popover；
- Mobile 显示 Dictionary Bottom Sheet；
- 关闭词典后继续停留在原阅读位置；
- 选中或触发指定 Mock 句子后显示简短理解工具；
- Reader 可以进入 Session Summary；
- Session Summary 可以直接 Done，或进入 Quick Review；
- 主题切换；
- 150–250ms、ease-out 的克制过渡动画。

### 3.3 明确不实现

- EPUB、TXT、网页或 PDF 的真实解析；
- 真词典 API；
- 真 AI 请求；
- IndexedDB 或其他持久化数据库；
- FSRS 排程；
- 登录、云同步；
- TOEFL 能力映射；
- 漫画、视频、YouTube；
- 完整 Library、Statistics 或 Settings 功能；
- 面向商业化的付费与增长机制。

## 4. 全局信息架构

Phase 1 路由建议：

```text
/                 Home
/reader/:bookId   Reader
/review           Quick Review
/session-summary  Session Summary
```

Library、Statistics、Settings 可以保留导航入口，但如果没有实现，应明确表现为不可用或轻量占位，不能伪装成已经完成的功能。

## 5. 全局视觉规范

### 5.1 Light Mode

- 页面背景：`#F7F7F5`
- 阅读区域：`#FFFDF9`
- 主文字：`#202124`
- 次级文字：`#737373`
- 分割线：`#E8E7E3`
- 主强调色：`#596CFF`
- 强调色浅背景：`#EEF0FF`
- 成功 / 掌握：`#5C8A72`

### 5.2 Dark Mode

- 页面背景：`#161719`
- 阅读区域：`#1D1E21`
- 主文字：`#EAEAEA`
- 次级文字：`#96989D`
- 分割线：`#303136`
- 强调色：`#8491FF`

禁止使用纯黑背景搭配纯白正文。

### 5.3 字体与正文

- UI：Inter 或系统字体；
- 小说正文：Literata，无法加载时回退 Georgia；
- 文章正文：Inter 或 Source Sans；
- 小说默认字号约 18px；
- 小说默认行高约 1.7；
- Desktop 正文最大宽度为 680–760px；
- Mobile 字号不能因适配而明显缩小。

### 5.4 组件参数

- 小组件圆角：8px
- 普通卡片：12px
- 大卡片：16px
- 弹窗：16px
- 按钮：10px
- 间距序列：4 / 8 / 12 / 16 / 24 / 32 / 48
- 图标：Lucide Icons
- Mobile 主要触摸目标约 44px 或更大

## 6. Home 页面规格

### 6.1 页面目标

用户进入首页后，应在几秒内知道自己上次读到哪里，并可以一次操作继续阅读。

### 6.2 内容优先级

1. Continue Reading
2. Recently Read
3. Quick Review
4. Library 入口
5. 次级数据或状态

学习天数、查词数量和统计不得成为首屏主视觉。

### 6.3 Desktop

- 左侧安静的主导航；
- 主区域显示问候语，但问候语不能抢过 Continue Reading；
- Continue Reading 使用主卡片，显示封面、书名、章节、轻量进度和继续按钮；
- Recently Read 显示少量最近内容；
- Quick Review 以低压力入口呈现，不显示庞大的待复习数字。

### 6.4 Mobile

- 单列布局；
- 顶部品牌与搜索入口；
- Continue Reading 位于首屏核心位置；
- Review / Stats / Library 使用紧凑快捷入口；
- Recently Read 适配窄屏；
- 底部导航不遮挡页面内容，并考虑安全区域。

## 7. Reader 页面规格

### 7.1 页面目标

让用户感觉自己正在阅读小说，而不是操作一个语言学习工具。

### 7.2 默认状态

- 无侧边栏；
- 无常驻大型工具栏；
- 正文居中并留有充足空白；
- 未查过的陌生词不高亮；
- 最近学习过的 Mock 词可以使用浅紫色细下划线；
- 顶部只保留返回、书名和轻量进度；
- 阅读工具在需要时出现，并保持低对比度。

### 7.3 单词查询

Mock 单词：`reluctantly`

至少显示：

- 单词；
- 音标；
- 简短中文释义；
- 当前原句；
- 一句非常短的上下文解释；
- 懂了；
- 加入学习；
- 更多。

点击单词即视为发生一次 lookup。是否点击“加入学习”是独立状态。

Desktop 使用 Floating Popover，尽量靠近目标词，并避免超出视口。Mobile 使用 Bottom Sheet，正文仍应保留足够上下文。

### 7.4 句子理解

Mock 句子：`Had it not been for his intervention...`

默认只显示：

```text
意思：
如果不是他的干预……

结构：
Had it not been for...
= If it had not been for...
```

提供：

- 翻译；
- Explain；
- Simplify English；
- 朗读；
- Explain More。

Explain More 才展示更详细内容。Phase 1 全部使用 Mock 响应。

## 8. Quick Review 页面规格

### 8.1 页面目标

用约 3 分钟复习少量高价值表达，同时让用户随时可以停止。

### 8.2 内容

- 使用 4–6 条 Mock 表达；
- 至少包含一题上下文填空；
- 例句来源与 Reader 使用的 Mock 内容保持一致；
- 反馈简短，避免夸张动画；
- 可以跳过；
- 不强调剩余任务、连续天数或正确率。

示例：

```text
Hermione ______ followed him into the room.
```

答案：`reluctantly`

## 9. Session Summary 页面规格

### 9.1 默认信息

```text
Nice reading session

38 min
5,420 words
12 lookups
4 expressions may be worth remembering.
```

### 9.2 操作层级

- 主操作：Done
- 次操作：Review 4 expressions

不要通过颜色、弹窗或文字暗示用户跳过复习是损失。

## 10. Mock 数据要求

至少包含：

- 3 本书；
- 1 本正在阅读的书；
- 每本书的封面、书名、作者、章节与阅读进度；
- 一段足够形成真实阅读页面的英文小说正文；
- 5–8 条词汇或表达；
- lookup 次数、来源句子、是否加入学习等状态；
- 4–6 条 Quick Review 项目；
- 一份 Session Summary。

Mock 数据必须通过清晰类型传入 UI，页面中不能散落大量硬编码业务数据。

## 11. 响应式验收视口

最低检查：

- 390 × 844：典型手机
- 768 × 1024：断点边界
- 834 × 1112：平板
- 1024 × 768：断点边界
- 1440 × 900：桌面

所有视口都必须确认：

- 无横向溢出；
- 无被遮挡的主要操作；
- 正文可读；
- Popover 或 Bottom Sheet 不越界；
- Light / Dark 对比清晰；
- 不依赖 hover 才能完成核心操作。

## 12. Phase 1 完成定义

只有同时满足以下条件，Phase 1 才算完成：

- 四个页面均可通过导航访问；
- Desktop、Tablet、Mobile 均有经过设计的布局；
- Light / Dark 均完整工作；
- Desktop 词典使用 Popover；
- Mobile 词典使用 Bottom Sheet；
- Reader 有可操作的 Mock 查词与句子理解流程；
- Quick Review 和 Session Summary 可完成完整 Mock 流程；
- 类型检查、代码检查和生产构建通过；
- 浏览器控制台无未处理错误；
- 不包含本规格明确排除的后端或真实业务能力。

