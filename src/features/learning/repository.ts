import { normalizeTerm } from './dictionary'
import type { LearningTerm, LookupRecord, ReadingExcerpt, VocabularyAction } from './types'
import { applyVocabularyAction, createLearningTerm, getVocabularyState, serializeLearningTerm } from './vocabulary-state'

export const learningDatabase = 'lumaread-learning'
export function openLearningDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let rejected = false
    const request = indexedDB.open(learningDatabase, 2)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains('lookups')) {
        const events = db.createObjectStore('lookups', { keyPath: 'id' })
        events.createIndex('createdAt', 'createdAt'); events.createIndex('normalized', 'normalized')
        db.createObjectStore('terms', { keyPath: 'normalized' })
      }
      if (!db.objectStoreNames.contains('sessions')) { const store = db.createObjectStore('sessions', { keyPath: 'id' }); store.createIndex('startedAt', 'startedAt') }
      if (!db.objectStoreNames.contains('reviewCards')) { const store = db.createObjectStore('reviewCards', { keyPath: 'normalized' }); store.createIndex('due', 'schedule.due') }
      if (!db.objectStoreNames.contains('reviewLogs')) { const store = db.createObjectStore('reviewLogs', { keyPath: 'id' }); store.createIndex('reviewedAt', 'reviewedAt') }
    }
    request.onsuccess = () => { const db = request.result; if (rejected) { db.close(); return }; db.onversionchange = () => db.close(); resolve(db) }
    request.onerror = request.onblocked = () => { rejected = true; reject(new Error('查询记录暂时无法保存，你仍可以继续阅读。')) }
  })
}
export async function learningTransaction<T>(stores: string[], mode: IDBTransactionMode, run: (tx: IDBTransaction, finish: (result: T) => void) => void): Promise<T> {
  const db = await openLearningDatabase()
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(stores, mode); let result: T
      tx.oncomplete = () => resolve(result)
      tx.onabort = tx.onerror = () => reject(new Error('查询记录暂时无法保存，你仍可以继续阅读。'))
      try { run(tx, (value) => { result = value }) } catch { tx.abort() }
    })
  } finally { db.close() }
}
export async function recordLookup(excerpt: ReadingExcerpt): Promise<{ term: LearningTerm; previous?: ReadingExcerpt }> {
  const normalized = normalizeTerm(excerpt.text)
  return learningTransaction(['terms', 'lookups'], 'readwrite', (tx, finish) => {
    const store = tx.objectStore('terms'), request = store.get(normalized)
    request.onsuccess = () => {
      const previous = request.result as LearningTerm | undefined
      const createdAt = new Date().toISOString()
      if (previous && !getVocabularyState(previous)) { tx.abort(); return }
      const fields = { normalized, text: excerpt.text, lookups: (previous?.lookups ?? 0) + 1, lastSeen: createdAt, example: excerpt }
      const term = previous ? serializeLearningTerm({ ...previous, ...fields }) : createLearningTerm(fields)
      store.put(term)
      tx.objectStore('lookups').put({ ...excerpt, id: crypto.randomUUID(), normalized, createdAt } satisfies LookupRecord)
      finish({ term, previous: previous?.example })
    }
  })
}
export type VocabularyUpdateResult = { outcome: 'saved'; term: LearningTerm } | { outcome: 'stale' | 'missing' }
export async function readLearningTerm(normalized: string): Promise<LearningTerm | undefined> {
  return learningTransaction(['terms'], 'readonly', (tx, finish) => {
    const request = tx.objectStore('terms').get(normalized)
    request.onsuccess = () => finish(request.result as LearningTerm | undefined)
  })
}
export async function updateVocabularyState(normalized: string, action: VocabularyAction, expectedRevision: number): Promise<VocabularyUpdateResult> {
  return learningTransaction(['terms'], 'readwrite', (tx, finish) => {
    const store = tx.objectStore('terms'), request = store.get(normalized)
    request.onsuccess = () => {
      const term = request.result as LearningTerm | undefined
      if (!term) { finish({ outcome: 'missing' }); return }
      const state = getVocabularyState(term)
      if (!state || !Number.isSafeInteger(expectedRevision) || expectedRevision < 0 || state.revision !== expectedRevision) { finish({ outcome: 'stale' }); return }
      try {
        const updated = applyVocabularyAction(term, action)
        store.put(updated); finish({ outcome: 'saved', term: updated })
      } catch { tx.abort() }
    }
  })
}
/** Accepts a displayed recommendation only while the user's latest choice still permits it. */
export async function acceptLearningCandidate(normalized: string, expectedRevision: number): Promise<'added' | 'stale'> {
  return learningTransaction(['terms', 'reviewCards', 'reviewLogs'], 'readwrite', (tx, finish) => {
    const read = tx.objectStore('terms').get(normalized)
    read.onsuccess = () => {
      const term = read.result as LearningTerm | undefined
      const state = getVocabularyState(term)
      if (!term || !state || state.proficiency !== 'unknown' || state.learningEnabled || term.candidateExcluded || !Number.isSafeInteger(expectedRevision) || expectedRevision < 0 || state.revision !== expectedRevision) { finish('stale'); return }
      const card = tx.objectStore('reviewCards').getKey(normalized)
      card.onsuccess = () => {
        if (card.result !== undefined) { finish('stale'); return }
        // Old logs have no normalized index. Scan without changing the DB version or records.
        const logs = tx.objectStore('reviewLogs').openCursor()
        logs.onsuccess = () => {
          const cursor = logs.result
          if (cursor?.value?.normalized === normalized) { finish('stale'); return }
          if (cursor) { cursor.continue(); return }
          try { tx.objectStore('terms').put(applyVocabularyAction(term, { type: 'enroll' })); finish('added') } catch { tx.abort() }
        }
      }
    }
  })
}
export async function recentLookups(): Promise<LookupRecord[]> {
  return learningTransaction(['lookups'], 'readonly', (tx, finish) => {
    const items: LookupRecord[] = [], request = tx.objectStore('lookups').index('createdAt').openCursor(null, 'prev')
    request.onsuccess = () => { const cursor = request.result; if (!cursor || items.length === 20) { finish(items); return }; items.push(cursor.value as LookupRecord); cursor.continue() }
  })
}
