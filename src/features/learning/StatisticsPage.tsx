import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ThemeToggle } from '../../components/ui'
import { readingTimeEnabled, setReadingTimeEnabled } from './reading-sessions'
import { setLearningStatus } from './repository'
import { readLearningData, readingDuration, summarizeLearning, type LocalLearningData } from './statistics'
import './learning.css'

export function StatisticsPage() {
  const [data, setData] = useState<LocalLearningData>()
  const [error, setError] = useState('')
  const [enabled, setEnabled] = useState(readingTimeEnabled)
  const [period, setPeriod] = useState<'week' | 'all'>('week')
  const [busy, setBusy] = useState(false)
  const load = useCallback(async () => { try { setData(await readLearningData()); setError('') } catch { setError('本机记录暂时无法读取，已有数据没有被清除。') } }, [])
  useEffect(() => { let active = true; void readLearningData().then((value) => { if (active) setData(value) }).catch(() => { if (active) setError('本机记录暂时无法读取。') }); return () => { active = false } }, [])
  const since = new Date(); since.setDate(since.getDate() - 6); since.setHours(0, 0, 0, 0)
  const stats = data && summarizeLearning(data, period === 'week' ? since.toISOString() : '')
  async function update(text: string, status: 'learning' | 'recognized' | 'unknown') { setBusy(true); try { await setLearningStatus(text, status); await load() } catch { setError('未能保存，请稍后重试。') } finally { setBusy(false) } }
  return <main className="learning-page" lang="zh-CN"><div className="learning-page__inner stats-inner"><header className="stats-header"><Link to="/">← 返回首页</Link><ThemeToggle /></header><p className="stats-eyebrow">Your reading, quietly kept</p><h1>阅读足迹</h1><p className="lookup-muted">只回看，不设目标。所有记录保存在这台设备，不上传到服务器。</p>
    <div className="learning-actions stats-period"><button type="button" aria-pressed={period === 'week'} onClick={() => setPeriod('week')}>最近 7 天</button><button type="button" aria-pressed={period === 'all'} onClick={() => setPeriod('all')}>全部记录</button></div>
    {error && <p role="alert">{error} <button type="button" onClick={() => { void load() }}>重试</button></p>}
    {!data && !error && <p role="status">正在读取本机记录…</p>}
    {stats && <><dl className="stats-metrics"><div><dt>阅读时间</dt><dd>{stats.activeMs ? readingDuration(stats.activeMs) : '尚无记录'}</dd></div><div><dt>读过的内容</dt><dd>{stats.resources} 本 / 篇</dd></div><div><dt>查词次数</dt><dd>{stats.lookups.length}</dd></div><div><dt>轻复习表达次数</dt><dd>{stats.reviews.length}</dd></div></dl>
      <section className="learning-page__card"><h2>最近阅读</h2>{stats.sessions.length ? <ul className="stats-list">{stats.sessions.slice(0, 12).map((session) => <li key={session.id}><strong>{session.bookTitle}</strong><small>{new Date(session.startedAt).toLocaleString()} · {readingDuration(session.activeMs)}</small></li>)}</ul> : <p>下次阅读时，会在这里安静地留下记录。</p>}</section>
      <section className="learning-page__card"><h2>值得再看一眼</h2><p className="lookup-muted">从反复查询中挑选，最多 5 个。只是建议，加入后才进入复习。</p>{stats.suggestions.length ? <ul className="stats-list">{stats.suggestions.map((term) => <li key={term.normalized}><strong lang="en">{term.text}</strong><p lang="en">{term.example.sentence}</p><small>{term.example.bookTitle} · 查询过 {term.lookups} 次</small><button disabled={busy} type="button" onClick={() => { void update(term.text, 'learning') }}>加入学习</button></li>)}</ul> : <p>暂时没有建议，继续享受阅读就好。</p>}</section>
      <section className="learning-page__card"><h2>我选择学习的表达</h2><p><Link to="/review">开始轻复习 →</Link></p>{stats.learning.length ? <ul className="stats-list">{stats.learning.slice(0, 50).map((term) => <li key={term.normalized}><strong lang="en">{term.text}</strong><small>{term.example.bookTitle}</small><div className="learning-actions"><button disabled={busy} type="button" onClick={() => { void update(term.text, 'recognized') }}>阅读时已认识 · 暂停复习</button><button disabled={busy} type="button" onClick={() => { void update(term.text, 'unknown') }}>移出学习</button></div></li>)}</ul> : <p>在查词卡片中点“加入学习”，再来这里轻松回想。</p>}{stats.learning.length > 50 && <small>仅展示最近列表中的前 50 个表达。</small>}</section>
      <section className="learning-page__card"><h2>复习回顾</h2>{stats.reviews.length ? <ul className="stats-list">{stats.reviews.slice(0, 12).map((review) => <li key={review.id}><strong lang="en">{review.text}</strong><small>{review.bookTitle} · {new Date(review.reviewedAt).toLocaleString()}</small></li>)}</ul> : <p>没有需要完成的任务。想复习时再来。</p>}</section>
    </>}
    <section className="learning-page__card learning-settings"><h2>记录与隐私</h2><label className="learning-check"><input type="checkbox" checked={enabled} onChange={(event) => { setEnabled(event.target.checked); setReadingTimeEnabled(event.target.checked) }} />自动记录阅读时长</label><p>仅阅读页处于前台且有焦点时计时；连续 2 分钟无操作会暂停，继续操作后恢复。时间是使用估计，不代表注意力测量。最近 7 天按会话开始时间归类。</p><small>关闭计时不会删除已有记录。查词及你主动提交的复习反馈仍会保存。不记录其他应用、输入内容或 API Key；不启动系统后台服务。查询不等于加入学习。</small></section>
  </div></main>
}
