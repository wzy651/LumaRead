# 自动词汇学习候选 V1：实现与验证

日期：2026-10-05。实现留在当前分支 `codex/learning-reader-20260926`，未提交、推送或合并。原有未跟踪 `AGENTS.md` 未修改。

## 完成行为

- 阅读足迹与现有会话总结页共用纯候选算法和列表。计算只发生在这些页面，未改 Reader 的选择、渲染、导航、计时或退出入口。
- 最近 30 天有至少两条有效查询记录、状态为 unknown 且未排除的表达才能入选。首次查询不推荐；最多 5 项，允许零项，不凑数。
- 按重复查询 `2 × min(N−1,3)`、不同语境 `2 × min(max(C−1,0),2)`、多个来源 +1、最近 7 天查询 +1、有原句语境 +1 排序。平分按最新查询时间、normalized 字符顺序处理。
- 语境使用来源加归一空白后的句子，不把区块 ID 或重复开关卡片当作不同遇见。没有词频猜测、LLM 调用或 lemma 合并。
- 推荐说明来自实际历史；统计推荐窗口固定为近 30 天，不随统计时间范围切换。会话推荐只显示推断会话中查过的表达及其会话原句，可参考其他近期查询排序。
- 候选列表在本次页面访问中固定；接受、重新读取数据及切换统计范围不会补位或改变顺序。接受后的行显示结果；同页再移出会更新状态提示。
- 展示、忽略和关闭推荐都不会改学习状态、写排除标记、创建 FSRS 卡片或写复习日志。
- `acceptLearningCandidate` 在 terms / reviewCards / reviewLogs 的同一事务中检查最新状态和排除条件。成功提交后才提示已加入；重复点击有保护，失效返回 stale，失败可以重试，卸载后忽略 UI 更新。
- 接受只设置 learning；卡片仍在原有 `getReviewQueue` 中延迟创建。现有 FSRS 调度、日志提交、revision 和 attemptId 幂等逻辑未改动。

## 数据兼容

- `LearningTerm.candidateExcluded?: boolean` 是唯一新增持久化字段。显式移出或撤销加入设为 true；后续查询保留；手动重新加入清除。recognized、active、learning、有卡片或历史复习日志的词不推荐。
- IndexedDB 仍为版本 2，没有新 store、index、批量回写或迁移版本。原 v1 → v2 升级路径保留，测试覆盖旧 unknown 与已加入记录。
- `readLearningData` 以 readonly 事务读取已有卡片键，不调用复习队列或修复卡片。
- 不更改或清除查词历史、复习日志、阅读数据、书籍、批注、笔记、设置、原生凭据或签名。测试仅使用 fake-indexeddb、jsdom 或隔离的 Playwright 浏览器上下文。

## 文件变更

| 文件 | 内容 |
| --- | --- |
| `src/features/learning/types.ts` | 可选候选排除字段 |
| `src/features/learning/repository.ts` | 保留排除意愿、共用状态写入、原子接受接口 |
| `src/features/learning/candidate-selection.ts` | 纯筛选、评分、说明与会话查询范围 |
| `src/features/learning/statistics.ts` | 只读卡片键及统一候选计算 |
| `src/features/learning/CandidateSuggestions.tsx` | 共用稳定列表、接受／失效／失败反馈 |
| `src/features/learning/StatisticsPage.tsx` | 阅读足迹接入，异步读取与卸载保护 |
| `src/features/session-summary/SessionSummaryPage.tsx` | 会话推荐、有效已结束会话检查、读取重试 |
| `src/features/learning/learning.css` | 推荐样式、44px 按钮及共享安全区边距 |
| `src/features/learning/candidate-repository.test.ts` | 持久化、并发接受、失败、v1 升级与旧日志保护 |
| `src/features/learning/candidate-selection.test.ts` | 30 天窗口、确定排序、评分、排除、单次查询及会话边界 |
| `src/features/learning/CandidateSuggestions.test.tsx` | 两页真实 IndexedDB 集成、稳定列表、重试、失效与卸载 |
| `tests/browser/learning-review.mjs` | 扩展推荐、移出／再加、FSRS 边界及响应式浏览器场景 |
| `docs/qa/vocabulary-candidates-20261005.md` | 本验证与交付记录 |

## 实际执行的验证

| 检查 | 结果 |
| --- | --- |
| `npm ci` | 按现有 lockfile 恢复依赖，未改依赖／lockfile |
| `npm test -- --exclude src/features/learning/candidate-repository.test.ts` | 开始实施时的基线：47 文件、238 测试通过 |
| `npm test -- src/features/learning/CandidateSuggestions.test.tsx src/features/learning/candidate-repository.test.ts src/features/learning/candidate-selection.test.ts src/features/learning/learning-data.test.ts src/features/learning/LookupContent.test.tsx` | 最终针对性检查：5 文件、56 测试通过 |
| `npm test` | 最终全量：50 文件、279 测试通过 |
| `npm run typecheck` | 通过 |
| `npm run lint` | 通过，没有关闭规则 |
| `npm run build` | 通过；Vite 保留超过 500kB chunk 的构建提醒 |
| `npm run test:learning-review` | 扩展的 7 组浏览器场景通过 |
| `npm run test:reading-help` | 原有 10 组多格式阅读帮助场景通过 |
| `npm run test:browser` | 原有 EPUB 分页边界、尺寸／排版变化与位置恢复脚本通过 |
| `git diff --check` | 通过 |
| 独立代码审查 | 静态审查未发现需要修复的正确性／回归问题 |

开发过程中先观察持久化／接受、选择算法与两页集成测试失败，再完成实现并观察通过。静态检查曾指出初始异步加载写法，改用已有 Promise 回调模式后通过；没有删改原有测试断言来消除失败。

浏览器场景覆盖真实导入 TXT、EPUB、DOCX、PDF 的查词链路；推荐两页无自动卡片／日志；原有评分和日志保存；移出后重查／重开不再推荐；手动加入清除排除标记；撤销再次排除；大量候选最多五个；首次查询不推荐；总结不串用另一会话例句；键盘 Enter、触摸、深浅主题、390×844、844×390、834×1112、1440×900 与模拟安全区。

截图已经目视检查手机尺寸的浅色总结与深色阅读足迹。自动化结果在 `.qa-artifacts/learning-review/results.json`、`.qa-artifacts/reading-help/results.json`，截图在相应目录；这些是浏览器证据，不能视为原生验收。

## 限制与风险

- 旧版本未复习便被移出的 unknown 词无法与从未加入的词区分。已有日志可保护部分旧记录；不能完整恢复过去的移出意愿。
- 查询没有 sessionId，使用来源和起止时间推断归属。重叠会话、进程突然终止及关闭计时后的会话缺失仍有既有限制；无结束会话时不替换成全局推荐。
- 不新增导入书籍的总结入口；导入书籍仍按现有流程退出，推荐可从阅读足迹查看。
- 词形仍按原 normalized 标识分开；没有真正的未查词遇见或频率排名。重复开同一句只能说明重复查询。
- 页面仍读取完整学习历史；候选分组一次完成，接受旧日志检查使用游标。非常长的历史尚未做设备性能压力测试。
- 更旧版本的 `recordLookup` 不认识排除字段，降级运行旧版本后可能丢失新排除意愿；兼容验证针对旧数据升级到新版本。
- 没有运行 Windows 原生或 Android 真机验收，也没有为此次纯前端改动运行 Rust／原生安装包构建。不能凭浏览器结果宣称系统栏、原生生命周期和设备持久化均已验证。

## Windows 原生手动验收（待执行）

1. 用隔离测试书籍分别查一个表达一次和两次，正常退出。阅读足迹应仅推荐重复查询词；打开总结应仅显示最近已记录会话中的词和原句。不接受时 Quick Review 不应出现新卡片。
2. 准备六个以上符合条件的词，用鼠标或 Tab／Enter 接受一项，快速重复点击。应只成功加入一次，原有五行不补位；进入 Quick Review 后才建立该词卡片，评分只保存一次。
3. 移出学习、重新查词、关闭应用再打开。表达应保持排除；手动加入后可以学习，再撤销后重新排除。已有日志和其他学习卡片应保留。
4. 调整窗口大小与主题，确认原句、来源、说明和按钮可访问。退出／重开 EPUB、PDF、TXT、DOCX，应恢复原位置，查词与笔记功能保持可用。
5. 在隔离测试环境模拟存储读取／事务失败，应出现错误及重试，不出现虚假成功；失败不应阻断返回书库继续阅读。

## Android 真机手动验收（待执行）

1. 使用同签名新版覆盖测试安装，不卸载、不清数据。确认原有书籍、位置、批注、学习词和日志保留。
2. 重复查询后退出阅读，在阅读足迹触摸接受一项并快速连点。应仅加入一次、不补位、不自动切换到复习；首次查询仍可手动加入。
3. 对同一词执行移出、重查、后台／恢复、关闭重开及手动再加，确认排除状态与记录正确，后台时间不计入阅读时长。
4. 检查窄屏、横竖屏、字体／主题变化、状态栏、导航栏、刘海安全区。原句和按钮应完整可滚动访问，触摸目标至少 44px。
5. 返回键应沿用现有面板／笔记／键盘优先级，再返回首页；接受请求期间返回，不应重复提交或在卸载页面后自动跳转。设置／笔记软键盘仍不应遮挡核心操作。
6. 离线查词、候选、学习与复习应工作；候选不依赖 AI 配置或新增收费请求。
