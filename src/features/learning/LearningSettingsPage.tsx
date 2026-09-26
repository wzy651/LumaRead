import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { LearningSettingsForm } from './LearningSettingsForm'
import { recentLookups } from './repository'
import type { LookupRecord } from './types'
import './learning.css'

export function LearningSettingsPage() {
  const [history, setHistory] = useState<LookupRecord[]>([])
  const [error, setError] = useState('')
  const build = typeof __LUMAREAD_BUILD__ === 'undefined' ? undefined : __LUMAREAD_BUILD__
  useEffect(() => { let current = true; void recentLookups().then((items) => { if (current) setHistory(items) }).catch(() => { if (current) setError('暂时无法读取查询记录。') }); return () => { current = false } }, [])
  return <main className="learning-page" lang="zh-CN"><div className="learning-page__inner"><Link to="/">← 返回首页</Link><h1>阅读帮助设置</h1><p>本地查词随时可用。需要理解语境时，再启用你选择的模型服务。</p><section className="learning-page__card"><h2>上下文解释</h2><LearningSettingsForm /></section><section className="learning-page__card"><h2>最近查过的表达</h2><p>保留原文帮助你回想，不会自动变成待复习任务。</p>{error ? <p role="status">{error}</p> : history.length ? <ul className="learning-history">{history.map((item) => <li key={item.id}><strong lang="en">{item.text}</strong><p lang="en">{item.sentence}</p><small>{item.bookTitle}</small></li>)}</ul> : <p>开始阅读后，点一个英文单词即可查词。选中短语或句子，再点“理解”；键盘也可用 Ctrl+Shift+L。</p>}</section><small>离线词典来自 ECDICT（MIT）。释义和 AI 解释均可能存在偏差，请结合原文理解。</small>{build && <p className="lookup-source">版本 {build.version} · 构建 {build.commit}</p>}</div></main>
}
