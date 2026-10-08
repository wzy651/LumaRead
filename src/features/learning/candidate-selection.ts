import type { LocalReadingSession } from './reading-sessions'
import type { LearningTerm, LookupRecord, ReadingExcerpt } from './types'
import { getVocabularyState } from './vocabulary-state'

export interface LearningCandidate { normalized: string; text: string; excerpt: ReadingExcerpt; score: number; reasons: string[]; lastLookupAt: string; stateRevision: number }
export interface CandidateSelectionData { terms: readonly LearningTerm[]; lookups: readonly LookupRecord[]; reviewCardKeys: readonly string[]; reviews: readonly { normalized: string }[] }
const dayMs = 86_400_000
const cleanSentence = (text: string) => text.normalize('NFKC').replace(/\s+/g, ' ').trim()
const compareText = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0
function validLookup(item: LookupRecord): boolean {
  return Boolean(item && typeof item.normalized === 'string' && item.normalized && typeof item.text === 'string' && item.text.trim() && typeof item.sentence === 'string' && typeof item.resourceKey === 'string' && item.resourceKey && typeof item.bookTitle === 'string' && typeof item.createdAt === 'string' && Number.isFinite(Date.parse(item.createdAt)))
}
function newer(a: LookupRecord, b: LookupRecord) {
  return Date.parse(a.createdAt) > Date.parse(b.createdAt) || (Date.parse(a.createdAt) === Date.parse(b.createdAt) && compareText(a.id, b.id) > 0)
}
/** Time/resource inference only: lookups do not carry a persisted session ID. */
export function sessionLookups(lookups: readonly LookupRecord[], session: LocalReadingSession): LookupRecord[] {
  const start = Date.parse(session.startedAt), end = Date.parse(session.endedAt ?? '')
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return []
  return lookups.filter((item) => validLookup(item) && item.resourceKey === session.resourceKey && Date.parse(item.createdAt) >= start && Date.parse(item.createdAt) <= end)
}
/** Pure, read-only selection. Lifetime lookup totals and dictionary membership are not scores. */
export function selectLearningCandidates(data: CandidateSelectionData, { now = new Date(), session }: { now?: Date; session?: LocalReadingSession } = {}): LearningCandidate[] {
  const time = now.getTime()
  if (!Number.isFinite(time)) return []
  const blocked = new Set([...data.reviewCardKeys, ...data.reviews.filter((log) => log && typeof log.normalized === 'string').map((log) => log.normalized)])
  const scoped = session ? new Map<string, LookupRecord>() : undefined
  if (scoped && session) for (const item of sessionLookups(data.lookups, session)) {
    const previous = scoped.get(item.normalized)
    if (!previous || newer(item, previous)) scoped.set(item.normalized, item)
  }
  const history = new Map<string, { count: number; contexts: Set<string>; resources: Set<string>; latest: LookupRecord; hasContext: boolean }>()
  for (const item of data.lookups) {
    if (!validLookup(item) || Date.parse(item.createdAt) < time - 30 * dayMs || Date.parse(item.createdAt) > time) continue
    const group = history.get(item.normalized) ?? { count: 0, contexts: new Set<string>(), resources: new Set<string>(), latest: item, hasContext: false }
    const sentence = cleanSentence(item.sentence)
    group.count++; group.resources.add(item.resourceKey)
    if (sentence) group.contexts.add(JSON.stringify([item.resourceKey, sentence]))
    if (sentence && sentence !== cleanSentence(item.text)) group.hasContext = true
    if (newer(item, group.latest)) group.latest = item
    history.set(item.normalized, group)
  }
  const candidates: LearningCandidate[] = []
  for (const term of data.terms) {
    const state = getVocabularyState(term)
    if (!term || !state || state.proficiency !== 'unknown' || state.learningEnabled || term.candidateExcluded || typeof term.text !== 'string' || !term.text.trim() || term.text.length > 80 || term.text.trim().split(/\s+/).length > 6 || blocked.has(term.normalized)) continue
    const group = history.get(term.normalized), displayed = scoped?.get(term.normalized)
    if (!group || group.count < 2 || (scoped && !displayed)) continue
    const excerpt = displayed ?? group.latest
    const recent = Date.parse(group.latest.createdAt) >= time - 7 * dayMs
    const score = 2 * Math.min(group.count - 1, 3) + 2 * Math.min(Math.max(0, group.contexts.size - 1), 2) + Number(group.resources.size >= 2) + Number(recent) + Number(group.hasContext)
    const reasons = [`近 30 天查询 ${group.count} 次`]
    if (group.contexts.size >= 2) reasons.push(`在 ${group.contexts.size} 个不同语境中查询过`)
    if (group.resources.size >= 2) reasons.push(`来自 ${group.resources.size} 本 / 篇内容`)
    if (recent) reasons.push('最近 7 天查询过')
    candidates.push({ normalized: term.normalized, text: term.text, excerpt, score, reasons, lastLookupAt: group.latest.createdAt, stateRevision: state.revision })
  }
  return candidates.sort((a, b) => b.score - a.score || Date.parse(b.lastLookupAt) - Date.parse(a.lastLookupAt) || compareText(a.normalized, b.normalized)).slice(0, 5)
}
