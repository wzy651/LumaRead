import { DocumentError, type DocumentRepository, type ReaderLocation, type StoredDocument } from '../domain/documents'

export class MemoryDocumentRepository implements DocumentRepository {
  private readonly documents = new Map<string, StoredDocument>(); private readonly locations = new Map<string, ReaderLocation>()
  async saveDocument(record: StoredDocument) { this.documents.set(record.document.id, record) }
  async getDocument(id: string) { return this.documents.get(id) }
  async listDocuments() { return [...this.documents.values()].map(({ document }) => document).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) }
  async hasDocument(fingerprint: string) { return [...this.documents.values()].some(({ document }) => document.fingerprint === fingerprint) }
  async saveLocation(location: ReaderLocation) { this.locations.set(location.documentId, location) }
  async getLocation(documentId: string) { return this.locations.get(documentId) }
}

const databaseName = 'lumaread-documents'; const databaseVersion = 1
function openDatabase(): Promise<IDBDatabase> { return new Promise((resolve, reject) => {
  if (typeof window === 'undefined' || !('indexedDB' in window)) { reject(new DocumentError('storage-failed', 'Local document storage is not available in this environment.')); return }
  const request = indexedDB.open(databaseName, databaseVersion)
  request.onupgradeneeded = () => { const db = request.result; if (!db.objectStoreNames.contains('documents')) { const store = db.createObjectStore('documents', { keyPath: 'document.id' }); store.createIndex('fingerprint', 'document.fingerprint', { unique: true }) } if (!db.objectStoreNames.contains('locations')) db.createObjectStore('locations', { keyPath: 'documentId' }) }
  request.onsuccess = () => resolve(request.result); request.onerror = () => reject(new DocumentError('storage-failed', 'LumaRead could not open local document storage.'))
}) }
function requestResult<T>(request: IDBRequest<T>) { return new Promise<T>((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(new DocumentError('storage-failed', 'LumaRead could not save your document.')) }) }
export class IndexedDbDocumentRepository implements DocumentRepository {
  async saveDocument(record: StoredDocument) { const db = await openDatabase(); try { await requestResult(db.transaction('documents', 'readwrite').objectStore('documents').put(record)) } finally { db.close() } }
  async getDocument(id: string) { const db = await openDatabase(); try { return await requestResult(db.transaction('documents').objectStore('documents').get(id)) } finally { db.close() } }
  async listDocuments() { const db = await openDatabase(); try { const records = await requestResult(db.transaction('documents').objectStore('documents').getAll()) as StoredDocument[]; return records.map(({ document }) => document).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) } finally { db.close() } }
  async hasDocument(fingerprint: string) { const db = await openDatabase(); try { return Boolean(await requestResult(db.transaction('documents').objectStore('documents').index('fingerprint').getKey(fingerprint))) } finally { db.close() } }
  async saveLocation(location: ReaderLocation) { const db = await openDatabase(); try { await requestResult(db.transaction('locations', 'readwrite').objectStore('locations').put(location)) } finally { db.close() } }
  async getLocation(documentId: string) { const db = await openDatabase(); try { return await requestResult(db.transaction('locations').objectStore('locations').get(documentId)) } finally { db.close() } }
}
let repository: DocumentRepository | undefined
export function getDocumentRepository() { repository ??= new IndexedDbDocumentRepository(); return repository }
export { databaseName, databaseVersion }
