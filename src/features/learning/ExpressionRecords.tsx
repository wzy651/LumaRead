import { useState } from 'react'
import { VocabularyDetails } from './VocabularyDetails'
import type { LearningTerm, VocabularyAction } from './types'

export function ExpressionRecords({ terms, busy, onAction }: { terms: LearningTerm[]; busy: boolean; onAction: (term: LearningTerm, action: VocabularyAction) => Promise<void> }) {
  const [page, setPage] = useState(0)
  const records = terms.filter((term) => term && typeof term.normalized === 'string' && typeof term.text === 'string').sort((a, b) => (typeof b.lastSeen === 'string' ? b.lastSeen : '').localeCompare(typeof a.lastSeen === 'string' ? a.lastSeen : '') || a.normalized.localeCompare(b.normalized))
  const lastPage = Math.max(0, Math.ceil(records.length / 50) - 1), currentPage = Math.min(page, lastPage)
  return <details className="learning-page__card vocabulary-records">
    <summary>表达记录</summary>
    <p className="lookup-muted">来自本机保存的查询。打开详情不会增加查询次数，也不需要逐项整理。</p>
    {records.length ? <><ul className="stats-list">{records.slice(currentPage * 50, (currentPage + 1) * 50).map((term) => <li key={term.normalized}><strong lang="en">{term.text}</strong><small>{term.example?.bookTitle}</small><VocabularyDetails term={term} busy={busy} onAction={onAction} /></li>)}</ul>
      {lastPage > 0 && <div className="learning-actions records-pagination"><button type="button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>上一页</button><button type="button" disabled={currentPage === lastPage} onClick={() => setPage(currentPage + 1)}>下一页</button></div>}
    </> : <p>还没有保存的表达。</p>}
  </details>
}
