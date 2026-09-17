import { IDBDatabase, indexedDB } from 'fake-indexeddb'
import { afterEach, describe, expect, it } from 'vitest'
import type { ImportedDocument, StoredDocument } from '../domain/documents'
import { databaseName, databaseVersion, IndexedDbDocumentRepository, MemoryDocumentRepository } from './document-repository'
Object.assign(globalThis, { indexedDB, window: globalThis })
const document: ImportedDocument = { id: 'one', format: 'txt', fileName: 'one.txt', fileSize: 3, importedAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', metadata: { title: 'One' }, fingerprint: 'fingerprint', status: 'ready' }
const record: StoredDocument = { document, source: new Blob(['one']), capabilities: { reflowable: true, supportsOriginalLayout: false, supportsTextSelection: true, supportsSearch: false, supportsTableOfContents: false, supportsPagination: false, supportsReadAloud: false }, sections: [{ id: 's', order: 0, blocks: [{ id: 'p', type: 'paragraph', text: 'one', order: 0 }] }] }
function deleteDatabase() { return new Promise<void>((resolve) => { const request = indexedDB.deleteDatabase(databaseName); request.onsuccess = () => resolve() }) }
function openV1() { return new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open(databaseName, 1); request.onupgradeneeded = () => { const store = request.result.createObjectStore('documents', { keyPath: 'document.id' }); store.createIndex('fingerprint', 'document.fingerprint', { unique: true }); request.result.createObjectStore('locations', { keyPath: 'documentId' }) }; request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) }) }
function openV2() { return new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open(databaseName, 2); request.onupgradeneeded = () => { const store = request.result.createObjectStore('documents', { keyPath: 'document.id' }); store.createIndex('fingerprint', 'document.fingerprint', { unique: true }); request.result.createObjectStore('locations', { keyPath: 'documentId' }) }; request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) }) }
afterEach(async () => { await deleteDatabase() })
describe('document repositories', () => {
  it('stores documents, duplicate fingerprints, and locations in memory', async () => { const repository = new MemoryDocumentRepository(); await repository.saveDocument(record); await repository.saveLocation({ documentId: 'one', sectionId: 's', sectionIndex: 0, progressPercent: 42, updatedAt: document.updatedAt }); await expect(repository.hasDocument('fingerprint')).resolves.toBe(true); await expect(repository.saveDocument(record)).rejects.toMatchObject({ code: 'duplicate-document' }); await expect(repository.listLocations()).resolves.toHaveLength(1) })
  it('creates v4 stores and reads documents and locations', async () => { const repository = new IndexedDbDocumentRepository(); await repository.saveDocument(record); await repository.saveLocation({ documentId: 'one', sectionId: 's', sectionIndex: 0, progressPercent: 42, updatedAt: document.updatedAt }); await expect(repository.getDocument('one')).resolves.toMatchObject({ capabilities: record.capabilities, sections: record.sections }); await expect(repository.listLocations()).resolves.toMatchObject([{ progressPercent: 42 }]); await expect(repository.saveDocument({ ...record, document: { ...document, id: 'two' } })).rejects.toMatchObject({ code: 'duplicate-document' }); expect(databaseVersion).toBe(4) })
  it('migrates v1 string content and supplies safe capabilities', async () => { const db = await openV1(); const transaction = db.transaction('documents', 'readwrite'); transaction.objectStore('documents').put({ document, source: new Blob(['one']), sections: [{ id: 'legacy', order: 0, content: ['legacy paragraph'] }] }); await new Promise<void>((resolve) => { transaction.oncomplete = () => resolve() }); db.close(); const migrated = await new IndexedDbDocumentRepository().getDocument('one'); expect(migrated).toMatchObject({ capabilities: { reflowable: true }, sections: [{ blocks: [{ type: 'paragraph', text: 'legacy paragraph' }] }] }) })
  it('keeps v2 documents and locations when adding activity storage', async () => { const db = await openV2(); const transaction = db.transaction(['documents', 'locations'], 'readwrite'); transaction.objectStore('documents').put(record); transaction.objectStore('locations').put({ documentId: 'one', sectionId: 's', sectionIndex: 0, progressPercent: 42, updatedAt: document.updatedAt }); await new Promise<void>((resolve) => { transaction.oncomplete = () => resolve() }); db.close(); const repository = new IndexedDbDocumentRepository(); await expect(repository.getDocument('one')).resolves.toMatchObject({ document: { id: 'one' } }); await expect(repository.getLocation('one')).resolves.toMatchObject({ progressPercent: 42 }) })
  it('reports unavailable storage without leaking platform errors', async () => { const savedWindow = globalThis.window; Object.assign(globalThis, { window: undefined }); try { await expect(new IndexedDbDocumentRepository().listDocuments()).rejects.toMatchObject({ code: 'storage-failed' }) } finally { Object.assign(globalThis, { window: savedWindow }) } })
})
  it('converts an IndexedDB transaction abort into a DocumentError', async () => {
    const originalTransaction = IDBDatabase.prototype.transaction
    IDBDatabase.prototype.transaction = function abortingTransaction(this: IDBDatabase, storeNames: string | string[], mode?: IDBTransactionMode) {
      const transaction = originalTransaction.call(this, storeNames, mode)
      if (storeNames === 'locations' && mode === 'readwrite') queueMicrotask(() => transaction.abort())
      return transaction
    }
    try {
      await expect(new IndexedDbDocumentRepository().saveLocation({ documentId: 'one', sectionId: 's', sectionIndex: 0, progressPercent: 42, updatedAt: document.updatedAt })).rejects.toMatchObject({ code: 'storage-failed' })
    } finally {
      IDBDatabase.prototype.transaction = originalTransaction
    }
  })
