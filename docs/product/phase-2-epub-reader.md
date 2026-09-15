# LumaRead Phase 2：真实 EPUB Reader 产品规格

状态：Ready for implementation v0.1  
基线：`phase1-ui-prototype`（提交 `6f48ef6`）  
范围：在不推翻 Phase 1 UI 的前提下，完成本地 EPUB 导入与真实阅读闭环。

## 1. 阶段目标

Phase 2 只解决一个问题：

> 用户能否从本地选择一本无 DRM 的英文 EPUB，并在 LumaRead 中舒适、稳定地阅读它。

Phase 1 已经确认 Home、Reader、Quick Review 与 Session Summary 的视觉和交互方向。Phase 2 不重新设计这些页面，也不提前实现词典、AI、FSRS 或完整数据库。

核心优先级保持不变：

> 阅读 > 理解 > 学习 > 数据

## 2. 最小用户闭环

```text
Home
→ Library / Open EPUB
→ 选择本地 .epub 文件
→ 校验并读取书籍信息
→ 显示导入结果
→ 打开真实 Reader
→ 阅读正文
→ 上一页 / 下一页 / 目录跳转
→ 返回 Home 或 Library
```

文件只在本地浏览器中处理，不上传到服务器。

## 3. 必须实现

### 3.1 本地 EPUB 导入

- 支持通过系统文件选择器选择 `.epub`；
- 拖放可以作为增强，但不是完成条件；
- 使用 `epub.js` 读取文件；
- 至少读取：书名、作者、封面、目录、spine；
- 缺失封面或作者时提供克制的回退展示；
- 导入成功后生成会话内 `bookId` 并进入 Reader；
- 明确说明当前阶段刷新页面后可能需要重新选择文件；
- 不把本地文件内容写入 `localStorage`。

### 3.2 真实 EPUB Reader

- 在现有 `/reader/:bookId` 路由内同时支持 Mock 示例书和会话内导入书；
- 真实书籍正文由 `epub.js` rendition 渲染；
- 支持可重排 EPUB（reflowable EPUB）；
- 支持上一页、下一页；
- 支持目录展示与章节跳转；
- 显示当前章节或位置，以及轻量阅读进度；
- Reader 的书名、章节和进度不能继续写死为 Mock 数据；
- 保持 Phase 1 的安静阅读视觉、工具栏淡出和 Light/Dark；
- EPUB iframe 内正文主题、字体、字号和行高应与 LumaRead 阅读设置同步；
- Mobile 与 Desktop 在同一任务中完成。

### 3.3 会话内状态

Phase 2 只要求当前浏览器标签页生命周期内保存：

- 已导入书籍元数据；
- EPUB 源数据；
- 当前 locator / CFI；
- 当前章节；
- 当前百分比；
- 阅读字号和主题同步状态。

刷新后如果 EPUB 源已经丢失，Reader 必须显示恢复页面，引导用户重新选择文件，不能静默跳回 Mock 示例书。

### 3.4 加载和错误状态

必须覆盖：

- 正在读取文件；
- 正在打开书籍；
- 文件不是 EPUB；
- EPUB 损坏或无法解析；
- 加密或 DRM 内容不受支持；
- 缺失 metadata / cover / navigation；
- 路由存在但会话源已经丢失；
- rendition 初始化失败。

错误文案应简短、明确，并提供“重新选择文件”或“返回 Library”。

## 4. 阅读交互

### Desktop

- 正文继续保持居中和充足留白；
- 阅读区域最大宽度延续 Phase 1；
- 上一页 / 下一页可以使用低对比按钮；
- 支持键盘左右方向键翻页，但输入框、弹层或可编辑元素获得焦点时不得触发；
- 目录可以使用轻量侧卡或 Popover；
- 阅读控制在静置后淡出。

### Mobile

- 正文不能简单缩小桌面布局；
- 上一页 / 下一页触摸目标至少约 44px；
- 目录使用 Bottom Sheet；
- 不使用会干扰文本选择的全屏点击热区；
- 考虑安全区域；
- 屏幕旋转或尺寸变化后 rendition 能正确重新布局。

## 5. Library / Open EPUB 页面

Phase 2 的 Library 是轻量入口，不是完整书库系统。

至少包含：

- Open EPUB 主操作；
- 本地处理说明；
- 支持格式说明；
- 导入中的反馈；
- 最近在当前会话导入的书籍；
- 无封面回退；
- 返回 Home。

不要加入云端书架、账号、标签、搜索、批量管理或复杂统计。

## 6. 与 Phase 1 的兼容要求

- Home 仍以 Continue Reading 为第一视觉重点；
- Mock 示例书必须继续可读，方便演示词典与句子解释；
- 真实 EPUB Reader 在 Phase 2 不要求点词查词；
- Mock 词典和句子解释不能被错误应用到任意 EPUB 文本；
- Quick Review 与 Session Summary 不扩展真实数据逻辑；
- Light/Dark、路由焦点、滚动恢复和可访问性不得回归。

## 7. 为 Phase 3 预留但不实现

EPUB 引擎需要保留以下接入点：

- rendition contents ready；
- 当前内容 document / window；
- selection change；
- pointer / click 坐标；
- 当前 CFI 与原句定位；
- 章节切换事件。

这些只作为适配器事件暴露。Phase 2 不实现真实分词、词典查询、查询记录或高亮。

## 8. 明确不实现

- IndexedDB 持久化书籍；
- 云同步或账号；
- 真实词典；
- AI 句子解释；
- FSRS 与 Vocabulary Database；
- 标注、笔记、书签管理；
- 全文搜索；
- TTS；
- PDF、TXT、网页、漫画或视频；
- 固定版式 EPUB 的完整适配；
- DRM 或加密 EPUB；
- 远程 URL 导入；
- 上传文件到任何服务。

## 9. 安全与资源管理

- 默认不启用 EPUB 内脚本；
- 不主动执行书籍中的 JavaScript；
- 外部链接不能替换当前 LumaRead 应用页面；
- 创建的 Blob URL 必须在不再使用时撤销；
- Reader 卸载或切换书籍时必须销毁 rendition 与 EPUB 实例；
- 旧的事件监听、ResizeObserver 和键盘监听必须清理；
- 不在日志中输出书籍正文或完整文件内容。

## 10. 完成定义

只有同时满足以下条件，Phase 2 才算完成：

- 用户可以选择并打开至少两本真实、无 DRM、可重排 EPUB；
- 一本带封面，一本缺失封面；
- metadata、目录和正文可以正常读取；
- 上一页、下一页与目录跳转正常；
- 当前章节和进度会随 rendition relocation 更新；
- Reader 在 390×844、834×1112、1440×900 下无横向溢出；
- Light/Dark 能同步到 EPUB 正文；
- 字号调整能同步到 EPUB 正文；
- 页面刷新后的源丢失状态有明确恢复路径；
- Mock 示例书功能没有回归；
- 无未处理控制台错误；
- typecheck、零警告 lint、build 和 `git diff --check` 通过；
- 没有实现本规格明确排除的后续功能。

