import { normalizeTerm } from '../../src/features/learning/dictionary'
import { readLearningTerm, updateVocabularyState } from '../../src/features/learning/repository'
import { getVocabularyState } from '../../src/features/learning/vocabulary-state'
import { getReviewQueue } from '../../src/features/review/review-service'
import type { LearningTerm, VocabularyAction } from '../../src/features/learning/types'

/** Existing fixtures use the real explicit actions; this is not a production compatibility setter. */
export async function setFixtureLearningStatus(text: string, status: LearningTerm['status']) {
  const normalized = normalizeTerm(text)
  const actions: VocabularyAction[] = status === 'learning' ? [{ type: 'enroll' }] : status === 'unknown' ? [{ type: 'unenroll' }] : status === 'recognized' ? [{ type: 'assess-and-unenroll', level: 'recognized' }] : [{ type: 'assess', level: 'active' }, { type: 'unenroll' }]
  for (const action of actions) {
    const term = await readLearningTerm(normalized), state = getVocabularyState(term)
    if (!state) throw new Error('Missing fixture term')
    const result = await updateVocabularyState(normalized, action, state.revision)
    if (result.outcome !== 'saved') throw new Error(`Fixture action was ${result.outcome}`)
  }
}
export async function reviewQueueCandidates(now?: Date, limit?: number) { return (await getReviewQueue(now, limit)).candidates }
