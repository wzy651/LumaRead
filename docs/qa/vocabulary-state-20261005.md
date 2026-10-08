# 词汇状态模型 V1：实现与验收记录

日期：2026-10-05。范围：本次批准的四阶段实现；不提交、不发布、不扩大词汇模型。

## 实现结果

`LearningTerm.vocabularyState` 保存 `proficiency`、`learningEnabled`、`basis`、可选 `assessedAt`、`revision`。新业务统一使用 `getVocabularyState()`；旧 `status` 为 readonly / deprecated 兼容镜像，固定投影为 `learningEnabled ? 'learning' : proficiency`。

解释、初始化、action 和镜像序列化集中在 `src/features/learning/vocabulary-state.ts`。repository 是这些写入函数的生产调用边界。旧 `setLearningStatus` / `writeLearningStatus` 退役；类型感知的边界测试检查生产读取、写入、解构、对象重建与违规导入，同时允许 HTTP 和其他领域自己的 status。

能力与主动复习分离。recognized / active 只能通过用户显式自评产生；查词、重复查询、候选、接受候选和 FSRS 评分均不改变能力。active 只在可折叠表达详情出现，不显示升级、徽章、掌握率或待完成能力任务。主查词动作保持“懂了，继续读”和“加入学习 / 移出学习”。

## 数据与 FSRS 边界

`lumaread-learning` 保持 IndexedDB v2，store、index、稳定键 `normalized` 不变。影响 terms；复用现有 lookups、reviewCards、reviewLogs、sessions。书库/位置/批注数据库、localStorage 设置、原生凭据存储及签名材料不变。

缺少新字段时集中解释：

| 旧 status | proficiency | learningEnabled | basis |
| --- | --- | --- | --- |
| unknown | unknown | false | unassessed |
| learning | unknown | true | unassessed |
| recognized | recognized | false | legacy |
| active | active | false | legacy |

纯读取不回写，不批量迁移，不补造 assessedAt。旧记录再次查词仍不物化新对象；首次显式状态 action 才物化。合法新状态优先于矛盾镜像；下次合法 term 写入重新投影。存在但损坏的新对象不回退到旧 status，不覆盖原记录，不初始化相关调度卡片；字典和阅读退出仍可用。

状态动作在事务内读取最新 term，验证 expectedRevision，再执行 enroll / unenroll / assess / assess-and-unenroll。实际语义变化（包括候选排除标记变化）增加状态 revision；事务 complete 后才返回 saved。stale / missing 不重放、不覆盖，UI 提示并读取最新状态。存储失败不宣称成功。

暂停或移出只关闭学习开关并设置 candidateExcluded，已有 card 的 schedule / revision 和全部 logs 原样保留，不入队。重新加入清除 candidateExcluded，继续使用原 card；仅不存在 card 时沿用 lazy initialization。损坏已有 card 保留并提示，不通过移出/重加重置。

overdue 恢复沿用原排序和队列上限（默认 5，最多 8），不制造额外 backlog UI。复习提交同时保护状态 revision、card revision；attemptId 保持幂等。card 与 log 在同一事务写入，任一步失败则整体回滚。FSRS 只更新调度和日志，不修改 proficiency。

候选保留原重复查询算法与访问期间稳定列表：unknown、未主动学习、未排除、无任何 card（包含暂停 card）、无历史 logs 才有资格。接受时事务内重新校验状态 revision、card 和 logs，只 enroll，不创建 card。单纯能力自评不改变 candidateExcluded。

历史歧义不可恢复：旧 recognized/active 是历史标记，不是能力证明；旧版本曾删除的 schedule 无法还原。重新加入且实际缺卡时只能 lazy initialize，原日志仍保留。旧程序能读镜像，但降级后的旧 writer 不能保证新对象同步或 card 保留，因此不能宣称降级写入安全。失败恢复不清库、不静默重置；测试只使用隔离数据。

## 文件清单

| 类别 | 文件 |
| --- | --- |
| 新状态模块 | `src/features/learning/vocabulary-state.ts` |
| 契约 | `src/features/learning/types.ts`、`src/domain/vocabulary.ts` |
| 持久化与调度 | `src/features/learning/repository.ts`、`src/features/review/review-service.ts` |
| 候选与统计 | `src/features/learning/candidate-selection.ts`、`CandidateSuggestions.tsx`、`statistics.ts`、`StatisticsPage.tsx`、`src/features/session-summary/SessionSummaryPage.tsx` |
| 新交互组件 | `src/features/learning/use-vocabulary-actions.ts`、`VocabularyDetails.tsx`、`ExpressionRecords.tsx` |
| 查词与复习 UI | `src/features/learning/LookupContent.tsx`、`learning.css`、`src/features/review/QuickReviewPage.tsx`、`src/features/reader/components/DictionaryContent.tsx` |
| 新状态测试 | `src/features/learning/vocabulary-state.test.ts`、`vocabulary-repository.test.ts`、`vocabulary-ui.test.tsx`、`vocabulary-boundary.test.ts` |
| 既有测试迁移 | `src/features/learning/learning.test.ts`、`learning-data.test.ts`、`candidate-repository.test.ts`、`LookupContent.test.tsx`、`CandidateSuggestions.test.tsx`；新增仅测试 fixture 辅助 `tests/helpers/vocabulary.ts` |
| 浏览器回归 | `tests/browser/learning-review.mjs`、`tests/browser/reading-help.mjs` |
| 验收记录 | 本文件 |

未修改依赖、lockfile、原生实现或文档解析逻辑。

## 完成审计与证据

| 目标 | 证据 |
| --- | --- |
| 唯一业务状态与镜像 | vocabulary-state 单元测试全部六组合；vocabulary-boundary 类型感知全生产路径检查；deprecated 契约 |
| 能力与意愿分离 | recognized/active 加入、移出测试；自评不影响排除与 enrollment；四种 FSRS 评分不改变能力 |
| 卡片保留与恢复 | repository 深比较 card schedule/revision/logs；overdue 队列上限；浏览器移出/恢复前后深比较 |
| 事务与明确动作 | repository latest-read / expectedRevision；并发动作；失败回滚；missing/stale；旧 setter 边界检查 |
| 旧数据读取 | 旧 v1 升级及 v2 测试；四种旧标记；首次 action 物化；纯读取不回写；损坏字段不 fallback |
| 候选推荐 | 原 candidate-selection / repository / component 测试保留；暂停 card 与历史 log 排除；接受无 card；ABA/stale |
| 低打扰 UI | 真 repository 组件测试；详情折叠；浏览器触控/键盘、窄屏/横屏/宽屏检查；active 仅详情 |
| 过期与重复提交 | 状态与 card revision 测试；attemptId 重复提交仅一条日志；过期复习明确提示未保存 |
| 未破坏既有行为 | 完整 Vitest；学习/复习、reading-help、多格式查词与 EPUB 边界浏览器回归；final diff review |

## 实际执行的验证

| 命令 | 结果 |
| --- | --- |
| `npm test -- src/features/learning/vocabulary-state.test.ts src/features/learning/vocabulary-repository.test.ts src/features/learning/vocabulary-ui.test.tsx src/features/learning/vocabulary-boundary.test.ts` | 4 files / 63 tests passed，exit 0 |
| `npm test` | 54 files / 342 tests passed，exit 0 |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| `npm run build` | exit 0；已有 >500kB chunk 提示，非失败 |
| `npm run test:learning-review` | 8 组场景通过，exit 0 |
| `npm run test:reading-help` | 10 组场景通过，exit 0 |
| `npm run test:browser` | EPUB 分页边界、窗口/字体/宽度/模式变化与位置恢复通过，exit 0 |
| `git diff --check` | 无 diff 错误；Windows 换行提示不影响结果 |

独立只读 final review 未发现 Critical / Important 问题。Minor 保留项：新详情 summary 的 display:flex 隐藏浏览器默认展开标记，仍可鼠标/键盘/触控操作；展开提示可以后续改善。本轮不扩大为额外交互重构。

浏览器证据目录：`.qa-artifacts/learning-review/`、`.qa-artifacts/reading-help/`、`.qa-artifacts/epub-pages-boundary/`。浏览器采用本地隔离数据及模型契约 fixture，不代表真实模型服务或原生平台验证。

## Windows 原生手动验证：pending

1. 使用隔离测试安装与测试数据，保存旧状态、排除标记、card schedule/revision 与 review logs 基线；覆盖有卡、无卡及 overdue 表达。
2. 在旧安装原位升级，保持应用身份与数据目录。检查书库、阅读位置、查询及复习日志保留，旧四状态可读取，首次状态 action 才物化新对象。
3. 在详情自评 recognized 和 active，分别加入、复习、移出、重新加入。预期能力保持，暂停不入队，原 card/logs 保留；恢复只显示正常有限队列。
4. 用 mouse、Tab/Enter 操作详情及学习按钮，缩放窗口。检查核心动作可达、状态只在详情展示，无横向遮挡。
5. 保留旧候选/复习界面，另一个界面修改状态，再提交旧操作。预期提示 stale、无新日志、不自动重放。
6. 关闭并重新打开应用，后台/恢复后检查状态、排除标记、卡片、日志及原阅读位置保持；后台时间不计入有效阅读。检查查词发音停止及返回优先级。

## Android 真机原位升级验证：pending

1. 使用隔离测试安装，以相同 package/application identity 和既有签名覆盖升级。不得卸载真实用户安装，不清应用数据，不更换签名。
2. 升级前保存上述基线，升级后核对旧状态、书库、阅读位置、查询、card/logs 均保留。卸载/重装通常会删除本地应用数据，不能替代原位升级验证。
3. 触控打开底部查词面板与详情，执行自评、加入、移出、恢复；验证 active 只在详情、暂停保留卡片、不制造 backlog。
4. 检查 Android Back、横竖屏、safe area、系统栏及复习软键盘；关闭面板返回原文，核心按钮不依赖 hover，不遮挡、不丢位置。
5. 后台、恢复、进程终止后重开，检查状态/排除/card/logs 持久化、后台计时暂停、监听清理与发音停止。
6. 验证旧候选与旧复习反馈被拒绝且不重放；临时存储失败不显示已保存，恢复后可安全重试。

浏览器模拟、前端构建和测试通过都不能替代上述原生验证；本次未构建 Windows 安装包/APK，未执行 Windows 原生或 Android 真机检查。

## 2026-10-07 提交前完整验证

在实际当前工作区重新运行全部请求的自动检查，没有暂存、提交或发布。初次完整测试为 54 文件 / 342 tests passed；最终检查发现现有日期测试仅覆盖无效字符串，因此增加真实 IndexedDB 损坏记录回归：due 为 Date 对象或数字，以及 last_review 为 Date 对象、null、空字符串。

`npm test -- src/features/learning/vocabulary-repository.test.ts` 首次结果为 27 passed / 5 failed。根因是 Date.parse 的类型转换及 last_review 的 truthiness 判断接受了损坏值。仅在 hydrate 增加持久化日期类型/有效性检查，保留损坏 card，不改变正常日期、队列规则、schedule 或 logs；同命令重跑为 32 passed / 0 failed。原测试断言保留，未删除测试、清数据或跳过检查。

修复后全部七个 npm 检查重新执行：

| 精确命令 | 最终结果 |
| --- | --- |
| `npm test` | 54 files passed / 0 failed；347 tests passed / 0 failed |
| `npm run typecheck` | exit 0，无类型诊断 |
| `npm run lint` | exit 0，无 lint 诊断 |
| `npm run build` | exit 0 |
| `npm run test:learning-review` | 8 场景组 passed / 0 errors，exit 0 |
| `npm run test:reading-help` | 10 场景组 passed / 0 errors，exit 0 |
| `npm run test:browser` | 1 script passed / 0 failed，产生 26 条 EPUB 测量，exit 0；测量条数不是单元测试数 |
| `git diff --check` | exit 0，无 whitespace errors |

提示：build 保留 >500kB chunk 提示，DOCX chunk 为 592.61kB；本次还打印 plugin timing 提示（hooks 2.9s / build 4.9s，59%）。Vitest 打印 worker-reuse 性能建议。Git 对 20 个已修改文件打印 LF→CRLF 自动转换提示，未进行全仓库换行或格式化。

最终审查包含全部 20 个 modified 与 10 个 untracked 文件。未发现真实凭据、调试语句、临时文件、冲突标记、生产生成输出或无关改动；两个 browser console.log 为原有验证结果输出。dist、.qa-artifacts、.local-cache、node_modules 均被忽略，不属于提交候选。依赖、lockfile、原生实现、签名、书库数据库及解析器未修改。自动化门槛通过，可以准备提交；Windows 原生与 Android 真机原位升级仍按上述步骤 pending。本轮新增的 narrow hydrate guard 未另行派发独立审查，不将先前审查结果当作对此补充改动的审查证明。
