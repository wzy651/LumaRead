// @vitest-environment jsdom
import { setFixtureLearningStatus, reviewQueueCandidates as getReviewQueue } from '../../../tests/helpers/vocabulary'
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { acceptLearningCandidate, learningDatabase, learningTransaction, openLearningDatabase, recordLookup } from './repository'
import { readLearningData, summarizeLearning } from './statistics'
import { submitReview } from '../review/review-service'

const excerpt = { text: 'bank', sentence: 'She sat on the bank.', resourceKey: 'imported:one', bookTitle: 'One' }
beforeEach(() => { vi.stubGlobal('indexedDB', new IDBFactory()); localStorage.clear() })
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('candidate exclusion and explicit acceptance', () => {
  it('upgrades old unknown v1 terms and lookup history without a new version or automatic card', async () => {
    const createdAt = new Date().toISOString()
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(learningDatabase, 1)
      request.onupgradeneeded = () => {
        const events = request.result.createObjectStore('lookups', { keyPath: 'id' })
        events.createIndex('createdAt', 'createdAt'); events.createIndex('normalized', 'normalized')
        events.add({ ...excerpt, id: 'old-first', normalized: 'bank', createdAt })
        events.add({ ...excerpt, id: 'old-second', normalized: 'bank', createdAt })
        request.result.createObjectStore('terms', { keyPath: 'normalized' }).add({ normalized: 'bank', text: 'bank', status: 'unknown', lookups: 2, lastSeen: createdAt, example: excerpt })
      }
      request.onerror = () => reject(request.error)
      request.onsuccess = () => { request.result.close(); resolve() }
    })
    const data = await readLearningData()
    expect(summarizeLearning(data).suggestions.map((item) => item.normalized)).toEqual(['bank'])
    expect(data.lookups.map((item) => item.id)).toEqual(['old-first', 'old-second'])
    expect(data.reviewCardKeys).toEqual([]); expect(data.reviews).toEqual([])
    expect(data.terms[0].candidateExcluded).toBeUndefined()
    const db = await openLearningDatabase(); expect(db.version).toBe(2); db.close()
    expect(await readLearningData()).toEqual(data)
    expect(await acceptLearningCandidate('bank', 0)).toBe('added')
    expect((await readLearningData()).reviewCardKeys).toEqual([])
  })

  it('preserves removal across later lookups and reopening without changing history', async () => {
    await recordLookup(excerpt); await setFixtureLearningStatus('bank', 'learning')
    const [card] = await getReviewQueue()
    await submitReview(card, 3, 'review-before-removal')
    await setFixtureLearningStatus('bank', 'unknown')
    expect((await readLearningData()).terms[0]).toMatchObject({ status: 'unknown', candidateExcluded: true })
    await recordLookup({ ...excerpt, sentence: 'The bank was closed.' })
    const db = await openLearningDatabase(); expect(db.version).toBe(2); db.close()
    const data = await readLearningData()
    expect(data.terms[0]).toMatchObject({ status: 'unknown', candidateExcluded: true, lookups: 2 })
    expect(data.lookups).toHaveLength(2); expect(data.reviews).toHaveLength(1)
    expect(await getReviewQueue()).toEqual([])
  })

  it('does not exclude ignored lookups, and manual re-add clears removal', async () => {
    await recordLookup(excerpt); await recordLookup(excerpt)
    expect((await readLearningData()).terms[0].candidateExcluded).not.toBe(true)
    await setFixtureLearningStatus('bank', 'learning'); await setFixtureLearningStatus('bank', 'unknown')
    await setFixtureLearningStatus('bank', 'learning')
    expect((await readLearningData()).terms[0]).toMatchObject({ status: 'learning' })
    expect((await readLearningData()).terms[0].candidateExcluded).toBeUndefined()
    await setFixtureLearningStatus('bank', 'unknown')
    expect((await readLearningData()).terms[0].candidateExcluded).toBe(true)
  })

  it('accepts only once and creates neither card nor review log until the existing flow runs', async () => {
    await recordLookup(excerpt); await recordLookup(excerpt)
    expect(await Promise.all([acceptLearningCandidate('bank', 0), acceptLearningCandidate('bank', 0)])).toEqual(['added', 'stale'])
    const data = await readLearningData()
    expect(data.terms[0].status).toBe('learning')
    expect(data.lookups).toHaveLength(2); expect(data.reviews).toEqual([])
    expect(data.reviewCardKeys).toEqual([])
    expect(await getReviewQueue()).toHaveLength(1)
  })

  it.each(['recognized', 'active', 'learning', 'unknown'] as const)('does not overwrite a candidate changed to %s', async (status) => {
    await recordLookup(excerpt); await recordLookup(excerpt)
    await setFixtureLearningStatus('bank', status)
    expect(await acceptLearningCandidate('bank', 0)).toBe('stale')
    expect((await readLearningData()).terms[0].status).toBe(status)
  })

  it('leaves an existing card untouched even if its term says unknown', async () => {
    await recordLookup(excerpt); await setFixtureLearningStatus('bank', 'learning')
    const [candidate] = await getReviewQueue()
    await learningTransaction(['terms'], 'readwrite', (tx, finish) => { tx.objectStore('terms').put({ ...candidate.term, status: 'unknown', vocabularyState: { ...candidate.term.vocabularyState!, learningEnabled: false, revision: 0 } }); finish(undefined) })
    expect(await acceptLearningCandidate('bank', 0)).toBe('stale')
    const persisted = await learningTransaction(['reviewCards'], 'readonly', (tx, finish) => { const read = tx.objectStore('reviewCards').get('bank'); read.onsuccess = () => finish(read.result) })
    expect(persisted).toEqual(candidate.card)
  })

  it('conservatively protects old reviewed unknown records without an exclusion field', async () => {
    await recordLookup(excerpt); await setFixtureLearningStatus('bank', 'learning')
    const [candidate] = await getReviewQueue(); await submitReview(candidate, 3, 'old-log')
    await setFixtureLearningStatus('bank', 'unknown')
    // Recreate a true legacy record with no exclusion or card, retaining only its historical log.
    await learningTransaction(['terms', 'reviewCards'], 'readwrite', (tx, finish) => { const oldTerm = { ...candidate.term }; delete oldTerm.vocabularyState; tx.objectStore('terms').put({ ...oldTerm, status: 'unknown' }); tx.objectStore('reviewCards').delete('bank'); finish(undefined) })
    expect(await acceptLearningCandidate('bank', 0)).toBe('stale')
    expect((await readLearningData()).reviews).toHaveLength(1)
  })

  it('rejects failed writes without reporting success or losing the old term', async () => {
    await recordLookup(excerpt); await recordLookup(excerpt)
    const put = IDBObjectStore.prototype.put
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, ...args: Parameters<typeof put>) {
      const request = put.apply(this, args)
      this.transaction.abort()
      return request
    })
    await expect(acceptLearningCandidate('bank', 0)).rejects.toThrow()
    vi.restoreAllMocks()
    expect((await readLearningData()).terms[0].status).toBe('unknown')
    expect((await readLearningData()).lookups).toHaveLength(2)
  })

  it('does not invent a missing term', async () => {
    expect(await acceptLearningCandidate('missing', 0)).toBe('stale')
    expect((await readLearningData()).terms).toEqual([])
  })
})
