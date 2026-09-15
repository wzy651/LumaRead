# LumaRead Phase 2：本地多格式文档阅读

状态：Ready for implementation v0.2  
基线：`phase1-ui-prototype`（提交 `6f48ef6`）  
范围：在不推翻 Phase 1 UI 的前提下，完成本地 EPUB、PDF、DOCX 与 TXT 导入和真实阅读闭环。

## 1. 阶段目标

Phase 2 解决：

> 用户能否选择自己已有的英文电子书或文档，并在 LumaRead 中稳定、舒适地阅读。

本阶段不是完整文档管理器。核心仍是阅读体验，而不是格式转换、排版还原或文件管理。

## 2. 首批支持格式

| 类型 | 扩展名 | 阅读模式 | Phase 2 支持程度 |
|---|---|---|---|
| EPUB | `.epub` | 可重排 | metadata、封面、目录、章节、翻页、进度 |
| PDF | `.pdf` | 固定页面 | 页面渲染、文本层、翻页、缩放、页码 |
| Word | `.docx` | 转换后可重排 | 标题、段落、列表、表格、图片与基础格式 |
| Text | `.txt` | 可重排 | UTF-8 与带 BOM 的常见 Unicode 文本 |

旧版二进制 Word `.doc` 不在浏览器端直接解析。选择 `.doc` 时提供明确说明，建议另存为 `.docx`、PDF 或 TXT 后重新导入。

暂不加入 Markdown、HTML、PPT、Excel、MOBI、AZW、RTF 和图片 OCR。

## 3. 用户闭环

```text
Home
→ Library / Open document
→ 选择本地文件
→ 自动识别格式并校验
→ 读取标题、作者、封面或文件信息
→ 打开对应 Reader
→ 阅读 / 翻页 / 目录或页码跳转
→ 返回 Home 或 Library
```

文件只在本地浏览器处理，不上传到服务器。

## 4. Library / Open Document

Library 是轻量导入入口，不是完整书库。

必须包含：

- Open document 主操作；
- 文件选择器接受 `.epub,.pdf,.docx,.txt`；
- 本地处理说明；
- 格式与限制说明；
- 导入、解析和失败状态；
- 当前会话最近打开的文档；
- 缺失封面时的安静回退；
- 导入成功后进入 `/reader/:documentId`；
- 返回 Home。

刷新后源文件丢失时，应引导用户重新选择文件，不静默打开 Mock 示例书。

## 5. 两种阅读模式

### 5.1 Reflow Reader

适用于 EPUB、DOCX、TXT：

- 使用现有 Serif 阅读视觉；
- 默认约 18px、约 1.7 行高；
- 正文宽度延续 Phase 1；
- 支持字号和主题；
- EPUB 支持目录、章节和上一页/下一页；
- DOCX 尽量保留语义结构，不追求像素级还原 Word 页面；
- TXT 按段落和空行组织正文。

### 5.2 Fixed Page Reader

适用于 PDF：

- 保持原始页面比例；
- 默认适合宽度；
- 支持上一页、下一页、页码与有限缩放；
- 支持可选择的文本层；
- Desktop 可以显示单页或连续页；
- Mobile 优先单页适宽，不产生页面级横向溢出；
- Dark Mode 改变应用背景和控制区，不默认反转 PDF 页面颜色。

禁止把 PDF 强制转换成 EPUB 式段落排版。

## 6. 通用 Reader 要求

- 继续使用 `/reader/:documentId`；
- Mock 示例书继续可读，用于演示 Phase 1 词典和句子解释；
- 真实文档不绑定 Mock 词典；
- 动态显示标题、位置和进度；
- 阅读工具静置后淡出；
- Desktop 与 Mobile 同步完成；
- 切换文档、离开 Reader 或组件卸载时释放解析器、worker、canvas、iframe、Blob URL 和监听器；
- React Strict Mode 下不得出现重复 iframe、canvas 或监听器。

## 7. 格式专属错误

必须覆盖：

- 文件扩展名或 MIME 不支持；
- 空文件；
- EPUB 损坏、加密或 DRM；
- PDF 损坏、受密码保护或页面渲染失败；
- DOCX 损坏、转换失败或包含无法支持的复杂布局；
- `.doc` 旧格式；
- TXT 解码失败或内容为空；
- 路由存在但会话文件已经丢失；
- 文档过大导致内存或渲染失败。

错误页面必须提供重新选择文件和返回 Library。

## 8. 会话内数据

Phase 2 只要求当前标签页内保存：

- 文档 ID、格式、文件名、标题、作者与封面；
- 原始 ArrayBuffer；
- 当前章节 / CFI 或 PDF 页码；
- 当前百分比；
- 字号、缩放和主题状态。

不把文件内容写入 `localStorage`，不在 Phase 2 建立 IndexedDB。

## 9. 安全与隐私

- 文件不上云；
- EPUB 脚本保持禁用；
- DOCX 转换产生的 HTML 必须经过清理后再进入 DOM；
- DOCX 外部文件访问保持禁用；
- PDF worker 使用项目本地构建资源，不依赖第三方 CDN；
- 文档中的外部链接不能替换当前 LumaRead 页面；
- 不在日志中输出正文或完整文件数据；
- 所有 Blob URL 必须撤销。

## 10. 为后续点词预留

各 adapter 只需暴露统一的内容事件：

- 文本选择；
- pointer / click 坐标；
- 当前位置；
- 可提取的上下文文本；
- EPUB CFI、PDF 页码或 reflow block ID。

Phase 2 不实现真实词典、分词、高亮、查询记录或 AI。

## 11. 明确不实现

- IndexedDB、云同步和账号；
- 真实词典、AI、FSRS；
- DRM EPUB、密码 PDF；
- `.doc` 解析；
- DOCX 像素级版式还原；
- PDF OCR 或扫描件文字识别；
- 标注、笔记、全文搜索、TTS；
- 远程 URL 导入；
- 完整书架管理。

## 12. 完成定义

- 能打开真实 EPUB、PDF、DOCX、TXT 各至少一份；
- EPUB 额外验证带封面和无封面各一本；
- PDF 文本型文档可渲染并选择文字；
- DOCX 标题、段落、列表、表格和图片至少有基础呈现；
- TXT 正确处理段落与空行；
- 两种 Reader 模式在 390×844、834×1112、1440×900 下无页面级横向溢出；
- Light/Dark、字号或 PDF 缩放正常；
- source-missing 和格式专属错误均有恢复路径；
- Mock Reader、Review 和 Summary 不回归；
- 无未处理控制台错误；
- typecheck、零警告 lint、build、`git diff --check` 通过。

