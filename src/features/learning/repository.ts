import { normalizeTerm } from './dictionary'
import type { LearningTerm, LookupRecord, ReadingExcerpt } from './types'

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
      const term: LearningTerm = { ...previous, normalized, text: excerpt.text, status: previous?.status ?? 'unknown', lookups: (previous?.lookups ?? 0) + 1, lastSeen: createdAt, example: excerpt }
      store.put(term)
      tx.objectStore('lookups').put({ ...excerpt, id: crypto.randomUUID(), normalized, createdAt } satisfies LookupRecord)
      finish({ term, previous: previous?.example })
    }
  })
}
function writeLearningStatus(tx: IDBTransaction, term: LearningTerm, status: LearningTerm['status']) {
  const updated = { ...term, status }
  if (status === 'unknown') updated.candidateExcluded = true
  if (status === 'learning') delete updated.candidateExcluded
  tx.objectStore('terms').put(updated)
  if (status !== 'learning') tx.objectStore('reviewCards').delete(term.normalized)
}
export async function setLearningStatus(text: string, status: LearningTerm['status']): Promise<void> {
  return learningTransaction(['terms', 'reviewCards'], 'readwrite', (tx, finish) => {
    const store = tx.objectStore('terms'), request = store.get(normalizeTerm(text))
    request.onsuccess = () => { const term = request.result as LearningTerm | undefined; if (term) writeLearningStatus(tx, term, status); else if (status !== 'learning') tx.objectStore('reviewCards').delete(normalizeTerm(text)); finish(undefined) }
  })
}
/** Accepts a displayed recommendation only while the user's latest choice still permits it. */
export async function acceptLearningCandidate(normalized: string): Promise<'added' | 'stale'> {
  return learningTransaction(['terms', 'reviewCards', 'reviewLogs'], 'readwrite', (tx, finish) => {
    const read = tx.objectStore('terms').get(normalized)
    read.onsuccess = () => {
      const term = read.result as LearningTerm | undefined
      if (!term || term.status !== 'unknown' || term.candidateExcluded) { finish('stale'); return }
      const card = tx.objectStore('reviewCards').getKey(normalized)
      card.onsuccess = () => {
        if (card.result !== undefined) { finish('stale'); return }
        // Old logs have no normalized index. Scan without changing the DB version or records.
        const logs = tx.objectStore('reviewLogs').openCursor()
        logs.onsuccess = () => {
          const cursor = logs.result
          if (cursor?.value?.normalized === normalized) { finish('stale'); return }
          if (cursor) { cursor.continue(); return }
          writeLearningStatus(tx, term, 'learning'); finish('added')
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
