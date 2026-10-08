// @vitest-environment jsdom
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { acceptLearningCandidate, learningTransaction, openLearningDatabase, recordLookup, updateVocabularyState } from './repository'
import { getVocabularyState } from './vocabulary-state'
import { readLearningData, summarizeLearning } from './statistics'
import { getReviewQueue, submitReview } from '../review/review-service'
import type { LearningCard } from '../review/review-service'
import type { LearningTerm, VocabularyAction } from './types'

const example = { text: 'bank', sentence: 'She sat on the bank.', resourceKey: 'one', bookTitle: 'One' }
const now = new Date('2026-10-05T12:00:00.000Z')
const legacy: LearningTerm = { normalized: 'bank', text: 'bank', status: 'unknown', lookups: 2, lastSeen: now.toISOString(), example }
beforeEach(() => { vi.stubGlobal('indexedDB', new IDBFactory()); vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(now) })
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers() })
async function putTerm(term: LearningTerm) { await learningTransaction(['terms'], 'readwrite', (tx, finish) => { tx.objectStore('terms').put(term); finish(undefined) }) }
async function term() { return (await readLearningData()).terms[0] }
async function cards() { return learningTransaction<LearningCard[]>(['reviewCards'], 'readonly', (tx, finish) => { const read = tx.objectStore('reviewCards').getAll(); read.onsuccess = () => finish(read.result as LearningCard[]) }) }
async function act(action: VocabularyAction) { const current = await term(); return updateVocabularyState('bank', action, getVocabularyState(current)!.revision) }
function assertMirror(current: LearningTerm, expected: LearningTerm['status']) { expect(current.status).toBe(expected); expect(current.vocabularyState).toBeDefined() }

describe('persisted vocabulary source of truth', () => {
  it.each([
    ['unknown', false, 'unknown'], ['unknown', true, 'learning'],
    ['recognized', false, 'recognized'], ['recognized', true, 'learning'],
    ['active', false, 'active'], ['active', true, 'learning'],
  ] as const)('persists the mirror for %s / learning=%s through real actions and lookup', async (proficiency, learningEnabled, mirror) => {
    await recordLookup(example); await act({ type: 'assess', level: proficiency })
    await act({ type: learningEnabled ? 'enroll' : 'unenroll' })
    assertMirror(await term(), mirror)
    const state = (await term()).vocabularyState
    await recordLookup(example)
    expect((await term()).vocabularyState).toEqual(state)
    assertMirror(await term(), mirror)
  })

  it('creates new unassessed terms without auto enrolling; repeated lookup preserves the state', async () => {
    await recordLookup(example); const first = await term()
    expect(first.vocabularyState).toEqual({ proficiency: 'unknown', learningEnabled: false, basis: 'unassessed', revision: 0 })
    assertMirror(first, 'unknown')
    await recordLookup(example)
    expect((await term()).vocabularyState).toEqual(first.vocabularyState)
    expect(await cards()).toEqual([])
  })

  it.each(['unknown', 'learning', 'recognized', 'active'] as const)('reads and requeries old %s without adding a state or assessment date', async (status) => {
    await putTerm({ ...legacy, status, extraFutureField: 'retain' } as LearningTerm)
    const before = await readLearningData()
    await readLearningData(); summarizeLearning(before)
    expect(await readLearningData()).toEqual(before)
    await recordLookup(example)
    expect(await term()).not.toHaveProperty('vocabularyState')
    expect((await term()).status).toBe(status)
    const result = await act({ type: 'enroll' })
    expect(result.outcome).toBe('saved')
    const updated = await term()
    expect(updated.vocabularyState?.assessedAt).toBeUndefined()
    expect(updated).toHaveProperty('extraFutureField', 'retain')
    expect(updated.vocabularyState?.proficiency).toBe(status === 'recognized' || status === 'active' ? status : 'unknown')
    assertMirror(updated, 'learning')
    const db = await openLearningDatabase(); expect(db.version).toBe(2); db.close()
  })

  it.each(['recognized', 'active'] as const)('preserves %s, card and logs when unenrolled then reenrolled', async (level) => {
    await recordLookup(example); await act({ type: 'assess', level }); assertMirror(await term(), level)
    await act({ type: 'enroll' }); assertMirror(await term(), 'learning')
    const [candidate] = (await getReviewQueue(now)).candidates
    await submitReview(candidate, 3, 'original', now)
    const originalCards = await cards(), originalLogs = (await readLearningData()).reviews
    await act({ type: 'unenroll' }); assertMirror(await term(), level)
    expect((await term()).candidateExcluded).toBe(true)
    expect(await cards()).toEqual(originalCards)
    expect((await readLearningData()).reviews).toEqual(originalLogs)
    expect((await getReviewQueue(new Date('2026-12-05'))).candidates).toEqual([])
    await act({ type: 'enroll' }); assertMirror(await term(), 'learning')
    expect((await term()).candidateExcluded).toBeUndefined()
    expect(await cards()).toEqual(originalCards)
    const resumed = (await getReviewQueue(new Date('2026-12-05'))).candidates
    expect(resumed).toHaveLength(1)
    expect(resumed[0].card).toEqual(originalCards[0])
    expect(getVocabularyState(resumed[0].term)?.proficiency).toBe(level)
    expect((await readLearningData()).reviews).toEqual(originalLogs)
  })

  it('self assessment and combined pause keep history; old review snapshots become stale', async () => {
    await recordLookup(example); await act({ type: 'enroll' })
    const [candidate] = (await getReviewQueue(now)).candidates, originalCards = await cards()
    await act({ type: 'assess', level: 'recognized' })
    expect(await submitReview(candidate, 3, 'after-assessment', now)).toBe('stale')
    await act({ type: 'assess-and-unenroll', level: 'recognized' })
    assertMirror(await term(), 'recognized')
    expect(await cards()).toEqual(originalCards)
    expect((await readLearningData()).reviews).toEqual([])
    await act({ type: 'enroll' })
    expect(await submitReview(candidate, 3, 'after-reenrollment', now)).toBe('stale')
    expect(await cards()).toEqual(originalCards)
  })

  it('accepts candidates only once at their displayed revision without initializing cards', async () => {
    await recordLookup(example); await recordLookup(example)
    expect(await Promise.all([acceptLearningCandidate('bank', 0), acceptLearningCandidate('bank', 0)])).toEqual(['added', 'stale'])
    assertMirror(await term(), 'learning')
    expect(getVocabularyState(await term())).toMatchObject({ proficiency: 'unknown', learningEnabled: true, revision: 1 })
    expect(await cards()).toEqual([]); expect((await readLearningData()).reviews).toEqual([])
  })

  it('rejects old candidate revisions even if ability is changed back to unknown', async () => {
    await recordLookup(example); await recordLookup(example)
    await act({ type: 'assess', level: 'recognized' }); await act({ type: 'assess', level: 'unknown' })
    expect(await acceptLearningCandidate('bank', 0)).toBe('stale')
    expect(getVocabularyState(await term())).toMatchObject({ proficiency: 'unknown', learningEnabled: false, revision: 2 })
  })

  it('obeys new state over contradictory legacy mirrors without writing during reads', async () => {
    await recordLookup(example); await recordLookup(example)
    await putTerm({ ...await term(), status: 'learning' })
    const before = await readLearningData()
    expect(summarizeLearning(before).learning).toEqual([])
    expect(summarizeLearning(before).suggestions).toHaveLength(1)
    expect((await getReviewQueue(now)).candidates).toEqual([])
    expect(await readLearningData()).toEqual(before)
    await recordLookup(example); assertMirror(await term(), 'unknown')
    await act({ type: 'enroll' }); await putTerm({ ...await term(), status: 'unknown' })
    expect(summarizeLearning(await readLearningData()).learning).toHaveLength(1)
    expect(summarizeLearning(await readLearningData()).suggestions).toEqual([])
    const [candidate] = (await getReviewQueue(now)).candidates
    expect(await submitReview(candidate, 4, 'mirror-conflict', now)).toBe('saved')
    expect(getVocabularyState(await term())?.proficiency).toBe('unknown')
  })

  it('preserves damaged state without falling back or initializing a card', async () => {
    const damaged = { ...legacy, status: 'learning', vocabularyState: { revision: -1 } } as LearningTerm
    await putTerm(damaged)
    expect((await getReviewQueue(now)).hasUnreadableRecords).toBe(true)
    expect(await cards()).toEqual([])
    expect(await updateVocabularyState('bank', { type: 'enroll' }, 0)).toEqual({ outcome: 'stale' })
    await expect(recordLookup(example)).rejects.toThrow()
    expect(await term()).toEqual(damaged)
  })

  it('returns missing and rejects concurrent actions without losing query updates', async () => {
    expect(await updateVocabularyState('missing', { type: 'enroll' }, 0)).toEqual({ outcome: 'missing' })
    await recordLookup(example)
    const results = await Promise.all([updateVocabularyState('bank', { type: 'enroll' }, 0), updateVocabularyState('bank', { type: 'assess', level: 'recognized' }, 0), recordLookup(example)])
    expect(results.slice(0, 2).map((item) => 'outcome' in item ? item.outcome : '')).toEqual(['saved', 'stale'])
    expect((await term()).lookups).toBe(2)
    assertMirror(await term(), 'learning')
  })

  it('rolls back both new state and mirror when a transaction aborts', async () => {
    await putTerm({ ...legacy, status: 'recognized' })
    const before = await readLearningData(), put = IDBObjectStore.prototype.put
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, ...args: Parameters<typeof put>) { const request = put.apply(this, args); this.transaction.abort(); return request })
    await expect(updateVocabularyState('bank', { type: 'enroll' }, 0)).rejects.toThrow()
    expect(await readLearningData()).toEqual(before)
    vi.restoreAllMocks()
    expect((await updateVocabularyState('bank', { type: 'enroll' }, 0)).outcome).toBe('saved')
    assertMirror(await term(), 'learning')
  })

  it.each([1, 2, 3, 4] as const)('FSRS rating %s cannot change an explicitly assessed ability', async (rating) => {
    await recordLookup(example); await act({ type: 'assess', level: 'active' }); await act({ type: 'enroll' })
    const original = (await term()).vocabularyState
    const [candidate] = (await getReviewQueue(now)).candidates
    expect(await submitReview(candidate, rating, `rating-${rating}`, now)).toBe('saved')
    expect((await term()).vocabularyState).toEqual(original)
    assertMirror(await term(), 'learning')
  })

  it('restores overdue cards under the normal queue limit without resetting any schedule', async () => {
    for (let i = 0; i < 12; i++) {
      const text = `word${i}`, { term: added } = await recordLookup({ ...example, text })
      await updateVocabularyState(text, { type: 'enroll' }, getVocabularyState(added)!.revision)
    }
    await getReviewQueue(now); const original = await cards()
    for (const item of (await readLearningData()).terms) {
      const paused = await updateVocabularyState(item.normalized, { type: 'unenroll' }, getVocabularyState(item)!.revision)
      expect(paused.outcome).toBe('saved')
      if (paused.outcome === 'saved') await updateVocabularyState(item.normalized, { type: 'enroll' }, getVocabularyState(paused.term)!.revision)
    }
    const result = await getReviewQueue(new Date('2026-12-05'))
    expect(result.candidates).toHaveLength(5)
    expect(await cards()).toEqual(original)
    expect((await readLearningData()).reviews).toEqual([])
  })

  it('does not replace a damaged existing card and preserves other queue entries', async () => {
    await recordLookup(example); await act({ type: 'enroll' }); await getReviewQueue(now)
    const [original] = await cards(), damaged = { ...original, schedule: { ...original.schedule, due: 'invalid' } }
    await learningTransaction(['reviewCards'], 'readwrite', (tx, finish) => { tx.objectStore('reviewCards').put(damaged); finish(undefined) })
    await act({ type: 'unenroll' }); await act({ type: 'enroll' })
    const { term: other } = await recordLookup({ ...example, text: 'river' })
    await updateVocabularyState('river', { type: 'enroll' }, getVocabularyState(other)!.revision)
    const queue = await getReviewQueue(now)
    expect(queue.hasUnreadableRecords).toBe(true)
    expect(queue.candidates.map((item) => item.term.normalized)).toEqual(['river'])
    expect((await cards()).find((item) => item.normalized === 'bank')).toEqual(damaged)
  })

  it.each([
    ['due', now], ['due', 2026],
    ['last_review', now], ['last_review', null], ['last_review', ''],
  ] as const)('isolates a persisted malformed %s date %j without losing healthy cards', async (field, value) => {
    for (const text of ['bank', 'meadow', 'river']) {
      const { term: added } = await recordLookup({ ...example, text })
      await updateVocabularyState(text, { type: 'enroll' }, getVocabularyState(added)!.revision)
    }
    await getReviewQueue(now)
    const original = (await cards()).find((item) => item.normalized === 'bank')!
    const damaged = { ...original, schedule: { ...original.schedule, [field]: value } }
    await learningTransaction(['reviewCards'], 'readwrite', (tx, finish) => { tx.objectStore('reviewCards').put(damaged); finish(undefined) })
    const before = await cards(), terms = (await readLearningData()).terms
    const queue = await getReviewQueue(now)
    expect(queue.hasUnreadableRecords).toBe(true)
    expect(queue.candidates.map((item) => item.term.normalized).sort()).toEqual(['meadow', 'river'])
    expect(await cards()).toEqual(before)
    expect((await readLearningData()).terms).toEqual(terms)
    expect((await readLearningData()).reviews).toEqual([])
  })

  it('rolls back card scheduling when writing the associated log fails', async () => {
    await recordLookup(example); await act({ type: 'enroll' })
    const [candidate] = (await getReviewQueue(now)).candidates, before = await cards()
    const add = IDBObjectStore.prototype.add
    vi.spyOn(IDBObjectStore.prototype, 'add').mockImplementation(function (this: IDBObjectStore, ...args: Parameters<typeof add>) { const request = add.apply(this, args); this.transaction.abort(); return request })
    await expect(submitReview(candidate, 3, 'failed-log', now)).rejects.toThrow()
    expect(await cards()).toEqual(before); expect((await readLearningData()).reviews).toEqual([])
    vi.restoreAllMocks()
    expect(await submitReview(candidate, 3, 'failed-log', now)).toBe('saved')
    expect((await readLearningData()).reviews).toHaveLength(1)
  })
})
