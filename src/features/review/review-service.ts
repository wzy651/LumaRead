import { createEmptyCard, fsrs, type Card, type Grade, type ReviewLog } from 'ts-fsrs'
import { learningTransaction } from '../learning/repository'
import type { LearningTerm } from '../learning/types'
import { getVocabularyState } from '../learning/vocabulary-state'

export type ReviewRating = 1 | 2 | 3 | 4
export interface LearningCard { normalized: string; schedule: Omit<Card, 'due' | 'last_review'> & { due: string; last_review?: string }; revision: number }
export interface LocalReviewLog { id: string; normalized: string; text: string; resourceKey: string; bookTitle: string; reviewedAt: string; rating: ReviewRating; scheduler: 'ts-fsrs@5.4.2'; log: Omit<ReviewLog, 'due' | 'review'> & { due: string; review: string } }
export interface ReviewCandidate { term: LearningTerm; card: LearningCard }
export interface ReviewQueueResult { candidates: ReviewCandidate[]; hasUnreadableRecords: boolean }
const scheduler = fsrs({ enable_fuzz: false })
function serialize(card: Card): LearningCard['schedule'] { return { ...card, due: card.due.toISOString(), last_review: card.last_review?.toISOString() } }
function hydrate(card: LearningCard): Card {
  const schedule = card.schedule
  if (!Number.isSafeInteger(card.revision) || card.revision < 0 || typeof schedule.due !== 'string' || !Number.isFinite(Date.parse(schedule.due)) || (schedule.last_review !== undefined && (typeof schedule.last_review !== 'string' || !Number.isFinite(Date.parse(schedule.last_review)))) || ![0, 1, 2, 3].includes(schedule.state) || ['stability', 'difficulty', 'elapsed_days', 'scheduled_days', 'learning_steps', 'reps', 'lapses'].some((key) => !Number.isFinite(schedule[key as keyof typeof schedule]) || Number(schedule[key as keyof typeof schedule]) < 0)) throw new Error('此复习记录暂时无法读取，原记录已保留。')
  return { ...schedule, due: new Date(schedule.due), last_review: schedule.last_review ? new Date(schedule.last_review) : undefined }
}

/** Lazily initializes only explicitly enrolled terms, including pre-FSRS learning records. */
export async function getReviewQueue(now = new Date(), limit = 5): Promise<ReviewQueueResult> {
  if (!Number.isFinite(now.getTime())) throw new Error('复习时间无效。')
  return learningTransaction(['terms', 'reviewCards'], 'readwrite', (tx, finish) => {
    const cards = tx.objectStore('reviewCards'), request = tx.objectStore('terms').getAll()
    const items: ReviewCandidate[] = []
    let hasUnreadableRecords = false
    request.onsuccess = () => {
      const terms = (request.result as LearningTerm[]).filter((term) => {
        const state = getVocabularyState(term)
        if (!state) { hasUnreadableRecords = true; return false }
        if (!state.learningEnabled) return false
        if (typeof term.normalized !== 'string' || !term.normalized || typeof term.text !== 'string' || typeof term.lastSeen !== 'string' || !term.example || typeof term.example.sentence !== 'string' || typeof term.example.text !== 'string' || typeof term.example.resourceKey !== 'string' || typeof term.example.bookTitle !== 'string') { hasUnreadableRecords = true; return false }
        return true
      })
      let remaining = terms.length
      if (!remaining) { finish({ candidates: [], hasUnreadableRecords }); return }
      for (const term of terms) {
        const read = cards.get(term.normalized)
        read.onsuccess = () => {
          const card: LearningCard = read.result === undefined ? { normalized: term.normalized, schedule: serialize(createEmptyCard(now)), revision: 0 } : read.result
          if (read.result === undefined) cards.put(card)
          try {
            if (card.normalized !== term.normalized) throw new Error('Invalid card identity')
            if (hydrate(card).due <= now) items.push({ term, card })
          } catch { hasUnreadableRecords = true }
          if (--remaining === 0) finish({ candidates: items.sort((a, b) => a.card.schedule.due.localeCompare(b.card.schedule.due) || a.term.lastSeen.localeCompare(b.term.lastSeen)).slice(0, Math.max(1, Math.min(8, limit))), hasUnreadableRecords })
        }
      }
    }
  })
}

export async function submitReview(candidate: ReviewCandidate, rating: ReviewRating, attemptId: string, now = new Date()): Promise<'saved' | 'stale'> {
  if (![1, 2, 3, 4].includes(rating) || !attemptId || !Number.isFinite(now.getTime())) throw new Error('复习反馈无效。')
  return learningTransaction(['reviewCards', 'reviewLogs', 'terms'], 'readwrite', (tx, finish) => {
    const cards = tx.objectStore('reviewCards'), logs = tx.objectStore('reviewLogs')
    const logRead = logs.get(attemptId)
    logRead.onsuccess = () => {
      if (logRead.result) { finish(logRead.result.normalized === candidate.term.normalized ? 'saved' : 'stale'); return }
      const termRead = tx.objectStore('terms').get(candidate.term.normalized)
      termRead.onsuccess = () => {
        const state = getVocabularyState(termRead.result as LearningTerm | undefined), displayed = getVocabularyState(candidate.term)
        if (!state?.learningEnabled || !displayed || state.revision !== displayed.revision) { finish('stale'); return }
        const read = cards.get(candidate.term.normalized)
        read.onsuccess = () => {
          const card = read.result as LearningCard | undefined
          if (!card || card.normalized !== candidate.term.normalized || card.revision !== candidate.card.revision) { finish('stale'); return }
          try {
            const result = scheduler.next(hydrate(card), now, rating as Grade)
            cards.put({ normalized: card.normalized, schedule: serialize(result.card), revision: card.revision + 1 } satisfies LearningCard)
            logs.add({ id: attemptId, normalized: card.normalized, text: candidate.term.text, resourceKey: candidate.term.example.resourceKey, bookTitle: candidate.term.example.bookTitle, reviewedAt: now.toISOString(), rating, scheduler: 'ts-fsrs@5.4.2', log: { ...result.log, due: result.log.due.toISOString(), review: result.log.review.toISOString() } } satisfies LocalReviewLog)
            finish('saved')
          } catch { tx.abort() }
        }
      }
    }
  })
}

export function reviewPrompt(term: LearningTerm) {
  const { sentence, selectionStart } = term.example
  const selected = term.example.text
  const start = selectionStart ?? sentence.indexOf(selected)
  if (start >= 0 && sentence.slice(start, start + selected.length) === selected && sentence.trim() !== selected.trim()) return { text: `${sentence.slice(0, start)}______${sentence.slice(start + selected.length)}`, cloze: true }
  return { text: sentence || term.text, cloze: false }
}
