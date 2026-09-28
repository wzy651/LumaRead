import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ThemeToggle } from '../../components/ui'
import { readLearningData, readingDuration, type LocalLearningData } from '../learning/statistics'
import './session-summary.css'

export function SessionSummaryPage() {
  const [data, setData] = useState<LocalLearningData>()
  const [error, setError] = useState('')
  useEffect(() => { let active = true; void readLearningData().then((value) => { if (active) setData(value) }).catch(() => { if (active) setError('本次汇总暂时无法读取，你仍可以回到书库继续阅读。') }); return () => { active = false } }, [])
  const latest = data?.sessions.filter((session) => session.endedAt).sort((a, b) => b.endedAt!.localeCompare(a.endedAt!))[0]
  const lookups = latest ? data?.lookups.filter((item) => item.resourceKey === latest.resourceKey && item.createdAt >= latest.startedAt && item.createdAt <= latest.endedAt!).length : 0
  const learning = data?.terms.some((term) => term.status === 'learning')
  return <main className="summary-page" lang="zh-CN"><header className="summary-header"><Link className="summary-brand" to="/">LumaRead</Link><ThemeToggle /></header><section className="summary-card"><p className="summary-eyebrow">A quiet place to stop</p><h1>Nice reading session</h1>{error ? <p role="status">{error}</p> : !data ? <p>正在整理本机记录…</p> : latest ? <><p className="summary-lede">{latest.bookTitle}</p><p>{readingDuration(latest.activeMs)} · {lookups} 次查询</p><small>最近一次已记录的阅读 · {new Date(latest.endedAt!).toLocaleString()}</small></> : <p>暂时没有计时记录。阅读本身就很好，不需要每一次都留下数据。</p>}<p>不复习也完全没关系。</p><div className="summary-actions"><Link className="review-exit" to="/">Done · 返回首页</Link>{learning && <Link to="/review">轻松回想几个表达</Link>}</div></section></main>
}
