import { getVocabularyState } from './vocabulary-state'
import type { LearningTerm, VocabularyAction } from './types'

const proficiencyLabels = { unknown: '尚未判断', recognized: '能看懂', active: '会使用' }
export function VocabularyDetails({ term, busy, onAction }: { term: LearningTerm; busy: boolean; onAction: (term: LearningTerm, action: VocabularyAction) => Promise<void> }) {
  const state = getVocabularyState(term)
  return <details className="vocabulary-details">
    <summary>这个表达</summary>
    {!state ? <p role="status">这个表达的状态暂时无法读取，原记录已保留。</p> : <div className="vocabulary-details__body" aria-busy={busy}>
      <dl><dt>我的判断</dt><dd>{proficiencyLabels[state.proficiency]}</dd><dt>主动复习</dt><dd>{state.learningEnabled ? '已加入' : '未加入'}</dd></dl>
      <small className="lookup-source">{state.basis === 'self' ? '自我判断' : state.basis === 'legacy' ? '历史标记 · 未经系统验证' : '尚无能力判断'}{state.assessedAt ? ` · ${new Date(state.assessedAt).toLocaleDateString()}` : ''}</small>
      <p className="lookup-muted">只按你在熟悉用法中的体验判断，不代表所有词义。无需每次阅读都维护。</p>
      <div className="learning-actions">
        <button type="button" disabled={busy} aria-pressed={state.proficiency === 'recognized'} onClick={() => { void onAction(term, { type: 'assess', level: 'recognized' }) }}>阅读时能看懂</button>
        <button type="button" disabled={busy} aria-pressed={state.proficiency === 'active'} onClick={() => { void onAction(term, { type: 'assess', level: 'active' }) }}>写作或口语中会使用</button>
        <button type="button" disabled={busy} onClick={() => { void onAction(term, { type: 'assess', level: 'unknown' }) }}>清除能力判断</button>
      </div>
      <small className="lookup-source">能力自评不会自动加入或退出复习。</small>
      <div className="learning-actions"><button type="button" disabled={busy} aria-pressed={state.learningEnabled} onClick={() => { void onAction(term, { type: state.learningEnabled ? 'unenroll' : 'enroll' }) }}>{state.learningEnabled ? '移出学习' : '加入学习'}</button></div>
    </div>}
  </details>
}
