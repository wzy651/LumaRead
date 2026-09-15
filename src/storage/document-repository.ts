import { DocumentError, type DocumentBlock, type DocumentCapabilities, type DocumentRepository, type ReaderLocation, type StoredDocument } from '../domain/documents'

const databaseName = 'lumaread-documents'; const databaseVersion = 2
export const defaultDocumentCapabilities: DocumentCapabilities = { reflowable: true, supportsTextSelection: true, supportsSearch: false, supportsTableOfContents: false, supportsPagination: false, supportsReadAloud: false }
type LegacyRecord = Omit<StoredDocument, 'capabilities' | 'sections'> & { sections: Array<{ id: string; title?: string; order: number; content?: string[]; blocks?: DocumentBlock[] }>; capabilities?: DocumentCapabilities }
function upgradeLegacyRecord(record: LegacyRecord): StoredDocument { return { ...record, capabilities: record.capabilities ?? defaultDocumentCapabilities, sections: record.sections.map((section) => ({ id: section.id, title: section.title, order: section.order, blocks: section.blocks ?? (section.content ?? []).map((text, order) => ({ id: `paragraph-${order}`, type: 'paragraph' as const, text, order })) })) } }
function storageError(message = 'LumaRead could not save local reading data.') { return new DocumentError('storage-failed', message) }
function openDatabase(): Promise<IDBDatabase> { return new Promise((resolve, reject) => {
  if (typeof window === 'undefined' || !('indexedDB' in window)) { reject(storageError('Local document storage is not available in this environment.')); return }
  const request = indexedDB.open(databaseName, databaseVersion)
  request.onupgradeneeded = (event) => { const db = request.result; const transaction = request.transaction!; if (!db.objectStoreNames.contains('documents')) { const store = db.createObjectStore('documents', { keyPath: 'document.id' }); store.createIndex('fingerprint', 'document.fingerprint', { unique: true }) } else { const store = transaction.objectStore('documents'); if (!store.indexNames.contains('fingerprint')) store.createIndex('fingerprint', 'document.fingerprint', { unique: true }); if (event.oldVersion < 2) store.openCursor().onsuccess = (cursorEvent) => { const cursor = (cursorEvent.target as IDBRequest<IDBCursorWithValue | null>).result; if (!cursor) return; cursor.update(upgradeLegacyRecord(cursor.value as LegacyRecord)); cursor.continue() } } if (!db.objectStoreNames.contains('locations')) db.createObjectStore('locations', { keyPath: 'documentId' }) }
  request.onsuccess = () => resolve(request.result); request.onerror = () => reject(storageError('LumaRead could not open local document storage.')); request.onblocked = () => reject(storageError('Local document storage is currently busy.'))
}) }
function requestResult<T>(request: IDBRequest<T>): Promise<T> { return new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error?.name === 'ConstraintError' ? new DocumentError('duplicate-document', 'This document is already in your library.') : storageError()) }) }
function transactionComplete(transaction: IDBTransaction): Promise<void> { return new Promise((resolve, reject) => { transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error?.name === 'ConstraintError' ? new DocumentError('duplicate-document', 'This document is already in your library.') : storageError()); transaction.onabort = () => reject(transaction.error?.name === 'ConstraintError' ? new DocumentError('duplicate-document', 'This document is already in your library.') : storageError()) }) }

export class MemoryDocumentRepository implements DocumentRepository {
  private readonly documents = new Map<string, StoredDocument>(); private readonly locations = new Map<string, ReaderLocation>()
  async saveDocument(record: StoredDocument) { if (await this.hasDocument(record.document.fingerprint)) throw new DocumentError('duplicate-document', 'This document is already in your library.'); this.documents.set(record.document.id, record) }
  async getDocument(id: string) { return this.documents.get(id) }
  async listDocuments() { return [...this.documents.values()].map(({ document }) => document).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) }
  async hasDocument(fingerprint: string) { return [...this.documents.values()].some(({ document }) => document.fingerprint === fingerprint) }
  async saveLocation(location: ReaderLocation) { this.locations.set(location.documentId, location) }
  async getLocation(documentId: string) { return this.locations.get(documentId) }
  async listLocations() { return [...this.locations.values()] }
}
export class IndexedDbDocumentRepository implements DocumentRepository {
  async saveDocument(record: StoredDocument) { const db = await openDatabase(); try { const transaction = db.transaction('documents', 'readwrite'); const completion = transactionComplete(transaction); await Promise.all([requestResult(transaction.objectStore('documents').put(record)), completion]) } finally { db.close() } }
  async getDocument(id: string) { const db = await openDatabase(); try { const transaction = db.transaction('documents'); const record = await requestResult(transaction.objectStore('documents').get(id)) as LegacyRecord | undefined; return record ? upgradeLegacyRecord(record) : undefined } finally { db.close() } }
  async listDocuments() { const db = await openDatabase(); try { const transaction = db.transaction('documents'); const records = await requestResult(transaction.objectStore('documents').getAll()) as LegacyRecord[]; return records.map(upgradeLegacyRecord).map(({ document }) => document).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) } finally { db.close() } }
  async hasDocument(fingerprint: string) { const db = await openDatabase(); try { const transaction = db.transaction('documents'); return Boolean(await requestResult(transaction.objectStore('documents').index('fingerprint').getKey(fingerprint))) } finally { db.close() } }
  async saveLocation(location: ReaderLocation) { const db = await openDatabase(); try { const transaction = db.transaction('locations', 'readwrite'); const completion = transactionComplete(transaction); await Promise.all([requestResult(transaction.objectStore('locations').put(location)), completion]) } finally { db.close() } }
  async getLocation(documentId: string) { const db = await openDatabase(); try { const transaction = db.transaction('locations'); return await requestResult(transaction.objectStore('locations').get(documentId)) } finally { db.close() } }
  async listLocations() { const db = await openDatabase(); try { const transaction = db.transaction('locations'); return await requestResult(transaction.objectStore('locations').getAll()) } finally { db.close() } }
}
let repository: DocumentRepository | undefined
export function getDocumentRepository() { repository ??= new IndexedDbDocumentRepository(); return repository }
export { databaseName, databaseVersion }
