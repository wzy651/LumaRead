// @vitest-environment jsdom
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { learningDatabase, learningTransaction, openLearningDatabase, recordLookup, setLearningStatus } from './repository'
import { ActiveReadingClock, saveReadingSession } from './reading-sessions'
import { readLearningData, summarizeLearning } from './statistics'
import { getReviewQueue, reviewPrompt, submitReview } from '../review/review-service'

const example = { text: 'bank', sentence: 'She sat on the bank of the river.', selectionStart: 15, resourceKey: 'imported:fixture', bookTitle: 'Fixture story', sectionId: 'one' }
beforeEach(() => { vi.stubGlobal('indexedDB', new IDBFactory()); localStorage.clear() })

describe('learning database v1 to v2', () => {
  it('retains old terms, lookup indexes and enrolled status, without auto-enrolling unknown words', async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(learningDatabase, 1)
      request.onupgradeneeded = () => {
        const db = request.result
        const lookups = db.createObjectStore('lookups', { keyPath: 'id' }); lookups.createIndex('createdAt', 'createdAt'); lookups.createIndex('normalized', 'normalized')
        lookups.add({ ...example, id: 'old', normalized: 'bank', createdAt: '2026-09-01T00:00:00.000Z' })
        db.createObjectStore('terms', { keyPath: 'normalized' }).add({ normalized: 'bank', text: 'bank', status: 'learning', lookups: 1, lastSeen: '2026-09-01T00:00:00.000Z', example })
      }
      request.onerror = () => reject(request.error)
      request.onsuccess = () => { request.result.close(); resolve() }
    })
    const db = await openLearningDatabase()
    expect(db.version).toBe(2)
    expect([...db.objectStoreNames]).toEqual(['lookups', 'reviewCards', 'reviewLogs', 'sessions', 'terms'])
    expect([...db.transaction('lookups').objectStore('lookups').indexNames]).toEqual(['createdAt', 'normalized'])
    db.close()
    expect((await getReviewQueue())[0].term.text).toBe('bank')
    expect((await readLearningData()).lookups[0].id).toBe('old')
    const reopened = await openLearningDatabase(); reopened.close()
    expect((await getReviewQueue()).length).toBe(1)
  })
})

describe('gentle FSRS review', () => {
  it('lookup and repeated lookup only suggest, never create cards', async () => {
    await recordLookup(example); await recordLookup(example)
    expect(await getReviewQueue()).toEqual([])
    const data = await readLearningData()
    expect(summarizeLearning(data).suggestions.map((term) => term.text)).toEqual(['bank'])
    expect(data.reviews).toEqual([])
  })
  it('creates an enrolled card, schedules with FSRS, and persists one feedback even with concurrent duplicate submits', async () => {
    await recordLookup(example); await setLearningStatus('bank', 'learning')
    const now = new Date('2026-09-28T10:00:00.000Z'), [candidate] = await getReviewQueue(now)
    const responses = await Promise.all([submitReview(candidate, 3, 'same-attempt', now), submitReview(candidate, 3, 'same-attempt', now)])
    expect(responses).toEqual(['saved', 'saved'])
    const data = await readLearningData()
    expect(data.reviews).toHaveLength(1)
    expect(data.reviews[0]).toMatchObject({ scheduler: 'ts-fsrs@5.4.2', rating: 3, bookTitle: 'Fixture story' })
    expect(data.terms[0].status).toBe('learning')
    expect(await getReviewQueue(now)).toEqual([])
    expect(await getReviewQueue(new Date('2026-10-28T10:00:00.000Z'))).toHaveLength(1)
  })
  it('does not grade skipped expressions or feedback after removal; stale cards cannot overwrite newer scheduling', async () => {
    await recordLookup(example); await setLearningStatus('bank', 'learning')
    const [candidate] = await getReviewQueue()
    expect((await readLearningData()).reviews).toHaveLength(0)
    await submitReview(candidate, 4, 'one')
    expect(await submitReview(candidate, 1, 'two')).toBe('stale')
    await setLearningStatus('bank', 'unknown')
    expect(await submitReview(candidate, 1, 'three')).toBe('stale')
    expect((await readLearningData()).reviews).toHaveLength(1)
    expect(await getReviewQueue()).toEqual([])
  })
  it('caps a quiet round at five and keeps source-specific occurrence in cloze', async () => {
    for (let index = 0; index < 12; index++) { await recordLookup({ ...example, text: `term${index}` }); await setLearningStatus(`term${index}`, 'learning') }
    expect(await getReviewQueue()).toHaveLength(5)
    expect(await getReviewQueue(new Date(), 999)).toHaveLength(8)
    const { term } = await recordLookup(example)
    expect(reviewPrompt(term).text).toBe('She sat on the ______ of the river.')
    expect(reviewPrompt({ ...term, example: { ...example, sentence: 'bank and bank', selectionStart: 9 } }).text).toBe('bank and ______')
    expect(reviewPrompt({ ...term, example: { ...example, sentence: 'bank', selectionStart: 0 } }).cloze).toBe(false)
  })
  it('waits for transaction completion and maps abort to a rejection', async () => {
    await expect(learningTransaction(['terms'], 'readwrite', (tx) => { tx.objectStore('terms').put({ normalized: 'test' }); tx.abort() })).rejects.toThrow()
    expect((await readLearningData()).terms).toEqual([])
  })
})

describe('local reading duration', () => {
  it('pauses for background, two-minute inactivity and OS sleep', () => {
    const clock = new ActiveReadingClock(0, true)
    for (let time = 10_000; time <= 130_000; time += 10_000) clock.tick(time)
    expect(clock.activeMs).toBe(120_000)
    clock.interact(130_000); clock.tick(140_000); expect(clock.activeMs).toBe(130_000)
    clock.focus(145_000, false); clock.tick(150_000); expect(clock.activeMs).toBe(135_000)
    clock.focus(160_000, true); clock.tick(170_000); expect(clock.activeMs).toBe(145_000)
    clock.tick(3_770_000); expect(clock.activeMs).toBe(145_000)
  })
  it('never counts unfocused startup or negative clock jumps', () => {
    const clock = new ActiveReadingClock(100, false)
    clock.tick(200); clock.focus(300, true); clock.tick(250)
    expect(clock.activeMs).toBe(0)
  })
  it('upserts snapshots without double time and ignores StrictMode zero-duration mounts', async () => {
    const base = { id: 'session', resourceKey: example.resourceKey, bookTitle: example.bookTitle, startedAt: '2026-09-28T00:00:00.000Z', updatedAt: '2026-09-28T00:00:20.000Z', activeMs: 20_000 }
    await saveReadingSession({ ...base, id: 'strict-mode', activeMs: 0 })
    await saveReadingSession(base); await saveReadingSession({ ...base, activeMs: 10_000 })
    await saveReadingSession({ ...base, activeMs: 25_000, endedAt: base.updatedAt })
    const data = await readLearningData()
    expect(data.sessions).toHaveLength(1); expect(summarizeLearning(data).activeMs).toBe(25_000)
    expect(summarizeLearning(data, '2026-10-01').sessions).toHaveLength(0)
  })
})
