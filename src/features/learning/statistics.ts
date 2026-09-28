import { learningTransaction } from './repository'
import { waitForSessionWrites, type LocalReadingSession } from './reading-sessions'
import type { LearningTerm, LookupRecord } from './types'
import type { LocalReviewLog } from '../review/review-service'

export interface LocalLearningData { sessions: LocalReadingSession[]; lookups: LookupRecord[]; terms: LearningTerm[]; reviews: LocalReviewLog[] }
export async function readLearningData(): Promise<LocalLearningData> {
  await waitForSessionWrites()
  return learningTransaction(['sessions', 'lookups', 'terms', 'reviewLogs'], 'readonly', (tx, finish) => {
    const result: LocalLearningData = { sessions: [], lookups: [], terms: [], reviews: [] }
    let remaining = 4
    for (const [store, field] of [['sessions', 'sessions'], ['lookups', 'lookups'], ['terms', 'terms'], ['reviewLogs', 'reviews']] as const) {
      const request = tx.objectStore(store).getAll()
      request.onsuccess = () => { Object.assign(result, { [field]: request.result }); if (--remaining === 0) finish(result) }
    }
  })
}
export function summarizeLearning(data: LocalLearningData, since = '') {
  const sessions = data.sessions.filter((item) => item.startedAt >= since && Number.isFinite(item.activeMs) && item.activeMs > 0).sort((a, b) => b.startedAt.localeCompare(a.startedAt))
  const lookups = data.lookups.filter((item) => item.createdAt >= since)
  const reviews = data.reviews.filter((item) => item.reviewedAt >= since).sort((a, b) => b.reviewedAt.localeCompare(a.reviewedAt))
  const suggestions = data.terms.filter((term) => term.status === 'unknown' && term.lookups >= 2 && term.text.length <= 80 && term.text.split(/\s+/).length <= 6).sort((a, b) => b.lookups - a.lookups || b.lastSeen.localeCompare(a.lastSeen)).slice(0, 5)
  return { sessions, lookups, reviews, suggestions, activeMs: sessions.reduce((total, item) => total + item.activeMs, 0), resources: new Set(sessions.map((item) => item.resourceKey)).size, learning: data.terms.filter((item) => item.status === 'learning') }
}
export function readingDuration(ms: number) { if (ms < 60_000) return '不到 1 分钟'; const minutes = Math.floor(ms / 60_000); return minutes < 60 ? `${minutes} 分钟` : `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分钟` }
