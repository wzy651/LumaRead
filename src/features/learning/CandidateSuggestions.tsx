import { useEffect, useId, useRef, useState } from 'react'
import { acceptLearningCandidate } from './repository'
import type { LearningCandidate } from './candidate-selection'
import type { LearningTerm } from './types'
import './learning.css'

function CandidateRow({ candidate, term, onAccepted }: { candidate: LearningCandidate; term?: LearningTerm; onAccepted: () => void }) {
  const [result, setResult] = useState<'added' | 'stale'>()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const inFlight = useRef(false), mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const unavailable = !term || term.candidateExcluded || (term.status !== 'unknown' && term.status !== 'learning')
  const label = unavailable || result === 'stale' ? '状态已更新' : result === 'added' || term.status === 'learning' ? '已加入学习' : saving ? '正在加入…' : '加入学习'
  async function accept() {
    if (inFlight.current || label !== '加入学习') return
    inFlight.current = true; setSaving(true); setError('')
    try {
      const outcome = await acceptLearningCandidate(candidate.normalized)
      if (mounted.current) { setResult(outcome); onAccepted() }
    } catch {
      if (mounted.current) setError('暂时未能保存，请再试一次。')
    } finally {
      inFlight.current = false
      if (mounted.current) setSaving(false)
    }
  }
  return <li aria-busy={saving}>
    <strong lang="en">{candidate.text}</strong>
    {candidate.excerpt.sentence && <p lang="en">{candidate.excerpt.sentence}</p>}
    <small>{candidate.excerpt.bookTitle}{candidate.excerpt.pageNumber ? ` · Page ${candidate.excerpt.pageNumber}` : ''}</small>
    <small>{candidate.reasons.join(' · ')}</small>
    <div aria-live="polite"><button disabled={saving || label !== '加入学习'} type="button" onClick={() => { void accept() }}>{label}</button></div>
    {error && <p role="alert">{error}</p>}
  </li>
}

/** Freeze this visit's recommendations: acceptance must never refill or reorder the list. */
export function CandidateSuggestions({ candidates, terms, session = false, onAccepted }: { candidates: LearningCandidate[]; terms: LearningTerm[]; session?: boolean; onAccepted: () => void }) {
  const [snapshot] = useState(candidates)
  const headingId = useId()
  const currentTerms = new Map(terms.filter(Boolean).map((term) => [term.normalized, term]))
  return <section className="learning-page__card learning-candidates" aria-labelledby={headingId}>
    <h2 id={headingId}>值得再看一眼</h2>
    <p className="lookup-muted">{session ? '从这次已记录阅读中查过的表达里挑选，参考近 30 天的重复查询。' : '来自近 30 天的重复查询，不随上方统计范围切换。'}最多 5 个，只是建议；选择加入后才进入复习。</p>
    {snapshot.length ? <ul className="stats-list">{snapshot.map((candidate) => <CandidateRow key={candidate.normalized} candidate={candidate} term={currentTerms.get(candidate.normalized)} onAccepted={onAccepted} />)}</ul> : <p>暂时没有建议，继续享受阅读就好。</p>}
  </section>
}
