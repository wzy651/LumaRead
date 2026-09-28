import { BookOpen } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ThemeToggle } from '../../components/ui'
import { lookupDictionary } from '../learning/dictionary'
import { PronunciationControls } from '../learning/PronunciationControls'
import { formatPhonetic } from '../learning/pronunciation'
import type { DictionaryEntry } from '../learning/types'
import { getReviewQueue, reviewPrompt, submitReview, type ReviewCandidate, type ReviewRating } from './review-service'
import './review.css'
import '../learning/learning.css'

function GentleReviewCard({ candidate, onNext }: { candidate: ReviewCandidate; onNext: () => void }) {
  const [entry, setEntry] = useState<DictionaryEntry>()
  const [revealed, setRevealed] = useState(false)
  const [answer, setAnswer] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const inFlight = useRef(false)
  const attemptId = useRef(crypto.randomUUID())
  const heading = useRef<HTMLHeadingElement>(null)
  const prompt = reviewPrompt(candidate.term)
  useEffect(() => {
    let active = true
    heading.current?.focus({ preventScroll: true })
    void lookupDictionary(candidate.term.text).then((value) => { if (active) setEntry(value) }).catch(() => undefined)
    return () => { active = false }
  }, [candidate.term.text])
  async function rate(rating: ReviewRating) {
    if (inFlight.current) return
    inFlight.current = true; setSaving(true); setError('')
    try { await submitReview(candidate, rating, attemptId.current); onNext() }
    catch { setError('反馈暂时没有保存。可重试，或跳过继续；不会重复记录。'); inFlight.current = false; setSaving(false) }
  }
  return <section className="review-card real-review" aria-busy={saving}>
    <p className="review-card__label">From your own reading</p>
    <h2 className="review-card__prompt" ref={heading} tabIndex={-1} lang="en">{revealed ? candidate.term.example.sentence || candidate.term.text : prompt.text}</h2>
    <p className="lookup-source">{candidate.term.example.bookTitle}{candidate.term.example.pageNumber ? ` · Page ${candidate.term.example.pageNumber}` : ''}</p>
    {!revealed ? <form className="review-form" onSubmit={(event) => { event.preventDefault(); setRevealed(true) }}>
      {prompt.cloze ? <label className="review-input-label">想一想这里用的表达，也可以直接看答案<input className="review-input" autoComplete="off" value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="Type the expression, if you like" lang="en" /></label> : <p>这个表达在原句里是什么意思？在心里回想即可。</p>}
      <div className="learning-actions"><button type="submit">看看答案</button><button type="button" onClick={onNext}>先跳过</button></div>
    </form> : <div className="review-reveal" aria-live="polite">
      <h3 lang="en">{candidate.term.text}</h3>
      {answer.trim() && <p className="lookup-muted">你的回想：<span lang="en">{answer}</span>。相近表达也可以，按自己的理解选择反馈。</p>}
      {entry?.phonetic && <p lang="en">{entry.word.toLowerCase() !== candidate.term.text.toLowerCase() ? `${entry.word} ` : ''}/{formatPhonetic(entry.phonetic)}/</p>}
      <p className="lookup-definition">{entry?.translation.split('\n').slice(0, 3).join('\n') || '本地词库暂无释义，请结合原句回想；不确定时可以先跳过。'}</p>
      {entry && <small className="lookup-source">ECDICT · 通用词义，请结合上方原句理解</small>}
      <PronunciationControls text={candidate.term.text} />
      <p>这次回想的感觉如何？</p>
      <div className="review-ratings">{([[1, '还没想起'], [2, '有点模糊'], [3, '想起来了'], [4, '很熟悉']] as const).map(([rating, label]) => <button disabled={saving} key={rating} type="button" onClick={() => { void rate(rating) }}>{label}</button>)}</div>
      <small className="lookup-source">仅调整下次出现的时间，不自动判断口语或写作能力。</small>
      <button disabled={saving} type="button" onClick={onNext}>先跳过，不记录反馈</button>
      {error && <p role="alert">{error}</p>}
    </div>}
  </section>
}

export function QuickReviewPage() {
  const [queue, setQueue] = useState<ReviewCandidate[]>()
  const [index, setIndex] = useState(0)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const doneHeading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    let active = true
    void getReviewQueue().then((items) => { if (active) { setQueue(items); setError('') } }).catch(() => { if (active) setError('复习记录暂时无法读取，原数据没有被清除。') })
    return () => { active = false }
  }, [retry])
  const complete = queue !== undefined && index >= queue.length
  useEffect(() => { if (complete) doneHeading.current?.focus({ preventScroll: true }) }, [complete])
  const candidate = queue?.[index]
  return <main className="review-page" lang="zh-CN"><header className="review-header"><Link aria-label="LumaRead home" className="review-brand" to="/"><BookOpen aria-hidden="true" size={20} /><span>LumaRead</span></Link><div className="review-header__actions"><Link className="review-exit" to="/">Done · 回到首页</Link><ThemeToggle /></div></header>
    <section aria-labelledby="review-title" className="review-content"><div className="review-intro"><p className="review-eyebrow">Quick review</p><h1 id="review-title">再遇见几个表达。</h1><p className="review-subtitle">只来自你主动加入学习的内容。约 3 分钟，也可以随时结束。</p></div>
      {error && <p role="alert">{error} <button type="button" onClick={() => setRetry((value) => value + 1)}>重试</button></p>}
      {!queue && !error && <p role="status">正在挑选适合回想的表达…</p>}
      {candidate && <GentleReviewCard key={`${candidate.term.normalized}:${candidate.card.revision}`} candidate={candidate} onNext={() => setIndex((value) => value + 1)} />}
      {complete && <section className="review-finished"><h2 ref={doneHeading} tabIndex={-1}>{queue.length ? '这样就很好。' : '现在可以安心读书。'}</h2><p>{queue.length ? '一小段回想就够了。没有需要补完的任务。' : '暂时没有适合复习的表达。查词不会自动加入；已经复习的内容会在合适时再出现。'}</p><div className="learning-actions"><Link className="review-exit" to="/">Done · 返回首页</Link><Link to="/library">打开书库</Link><Link to="/statistics">查看学习的表达</Link></div></section>}
    </section></main>
}
