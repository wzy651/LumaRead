import { normalizeTerm } from './dictionary'
import type { LearningTerm, LookupRecord, ReadingExcerpt } from './types'

export const learningDatabase = 'lumaread-learning'
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let rejected = false
    const request = indexedDB.open(learningDatabase, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      const events = db.createObjectStore('lookups', { keyPath: 'id' })
      events.createIndex('createdAt', 'createdAt'); events.createIndex('normalized', 'normalized')
      db.createObjectStore('terms', { keyPath: 'normalized' })
    }
    request.onsuccess = () => { const db = request.result; if (rejected) { db.close(); return }; db.onversionchange = () => db.close(); resolve(db) }
    request.onerror = request.onblocked = () => { rejected = true; reject(new Error('查询记录暂时无法保存，你仍可以继续阅读。')) }
  })
}
async function transaction<T>(stores: string[], mode: IDBTransactionMode, run: (tx: IDBTransaction, finish: (result: T) => void) => void): Promise<T> {
  const db = await open()
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
  return transaction(['terms', 'lookups'], 'readwrite', (tx, finish) => {
    const store = tx.objectStore('terms'), request = store.get(normalized)
    request.onsuccess = () => {
      const previous = request.result as LearningTerm | undefined
      const createdAt = new Date().toISOString()
      const term: LearningTerm = { normalized, text: excerpt.text, status: previous?.status ?? 'unknown', lookups: (previous?.lookups ?? 0) + 1, lastSeen: createdAt, example: excerpt }
      store.put(term)
      tx.objectStore('lookups').put({ ...excerpt, id: crypto.randomUUID(), normalized, createdAt } satisfies LookupRecord)
      finish({ term, previous: previous?.example })
    }
  })
}
export async function setLearningStatus(text: string, status: LearningTerm['status']): Promise<void> {
  return transaction(['terms'], 'readwrite', (tx, finish) => {
    const store = tx.objectStore('terms'), request = store.get(normalizeTerm(text))
    request.onsuccess = () => { const term = request.result as LearningTerm | undefined; if (term) store.put({ ...term, status }); finish(undefined) }
  })
}
export async function recentLookups(): Promise<LookupRecord[]> {
  return transaction(['lookups'], 'readonly', (tx, finish) => {
    const items: LookupRecord[] = [], request = tx.objectStore('lookups').index('createdAt').openCursor(null, 'prev')
    request.onsuccess = () => { const cursor = request.result; if (!cursor || items.length === 20) { finish(items); return }; items.push(cursor.value as LookupRecord); cursor.continue() }
  })
}
