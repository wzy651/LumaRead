import type { LearningTerm, Proficiency, VocabularyAction, VocabularyState } from './types'

const isProficiency = (value: unknown): value is Proficiency => value === 'unknown' || value === 'recognized' || value === 'active'
const invalidState = () => new Error('这个表达的状态暂时无法读取，原记录已保留。')

/** The only legacy interpretation boundary. Presence of damaged new data never falls back. */
export function getVocabularyState(term: LearningTerm | undefined | null): VocabularyState | undefined {
  if (!term || typeof term !== 'object') return undefined
  if (Object.hasOwn(term, 'vocabularyState')) {
    const value = term.vocabularyState
    if (!value || typeof value !== 'object' || !isProficiency(value.proficiency) || typeof value.learningEnabled !== 'boolean' || !['unassessed', 'self', 'legacy'].includes(value.basis) || !Number.isSafeInteger(value.revision) || value.revision < 0 || (value.assessedAt !== undefined && (typeof value.assessedAt !== 'string' || !Number.isFinite(Date.parse(value.assessedAt))))) return undefined
    return { ...value }
  }
  const status = term.status
  if (status !== 'learning' && !isProficiency(status)) return undefined
  const proficiency = status === 'learning' ? 'unknown' : status
  return { proficiency, learningEnabled: status === 'learning', basis: proficiency === 'unknown' ? 'unassessed' : 'legacy', revision: 0 }
}

/** Storage mirror only; business code must never read the projected value. */
export function serializeLearningTerm(term: LearningTerm): LearningTerm {
  const state = getVocabularyState(term)
  if (!state) throw invalidState()
  return { ...term, status: state.learningEnabled ? 'learning' : state.proficiency }
}

export function createLearningTerm(fields: Omit<LearningTerm, 'status' | 'vocabularyState'>): LearningTerm {
  return serializeLearningTerm({ ...fields, status: 'unknown', vocabularyState: { proficiency: 'unknown', learningEnabled: false, basis: 'unassessed', revision: 0 } })
}

export function applyVocabularyAction(term: LearningTerm, action: VocabularyAction, now = new Date()): LearningTerm {
  const previous = getVocabularyState(term)
  if (!previous) throw invalidState()
  const state = { ...previous }, updated = { ...term }
  switch (action.type) {
    case 'enroll': state.learningEnabled = true; delete updated.candidateExcluded; break
    case 'unenroll': state.learningEnabled = false; updated.candidateExcluded = true; break
    case 'assess':
    case 'assess-and-unenroll': {
      if (!isProficiency(action.level) || (action.type === 'assess-and-unenroll' && action.level !== 'recognized') || !Number.isFinite(now.getTime())) throw new Error('能力判断无效。')
      if (previous.proficiency !== action.level || previous.basis !== 'self') {
        state.proficiency = action.level; state.basis = 'self'; state.assessedAt = now.toISOString()
      }
      if (action.type === 'assess-and-unenroll') { state.learningEnabled = false; updated.candidateExcluded = true }
      break
    }
    default: throw new Error('状态操作无效。')
  }
  if (state.proficiency !== previous.proficiency || state.learningEnabled !== previous.learningEnabled || state.basis !== previous.basis || state.assessedAt !== previous.assessedAt || updated.candidateExcluded !== term.candidateExcluded) {
    if (previous.revision >= Number.MAX_SAFE_INTEGER) throw new Error('状态版本暂时无法更新，原记录已保留。')
    state.revision++
  }
  return serializeLearningTerm({ ...updated, vocabularyState: state })
}
