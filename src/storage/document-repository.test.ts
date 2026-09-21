// @vitest-environment jsdom
import { IDBDatabase, IDBFactory } from 'fake-indexeddb'
import { afterEach, describe, expect, it } from 'vitest'
import type { ImportedDocument, StoredDocument } from '../domain/documents'
import type { ReadingActivity } from '../domain/reading-activity'
import { databaseName, databaseVersion, IndexedDbDocumentRepository } from './document-repository'
import { IndexedDbReadingActivityRepository } from './reading-activity-repository'
import { openDatabase, requestResult } from './database'

const pdfDocument: ImportedDocument = { id: 'pdf-one', format: 'pdf', fileName: 'one.pdf', fileSize: 3, importedAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', metadata: { title: 'PDF One' }, fingerprint: 'pdf-fingerprint', status: 'ready' }
const txtDocument: ImportedDocument = { id: 'txt-one', format: 'txt', fileName: 'one.txt', fileSize: 3, importedAt: '2026-01-02T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z', metadata: { title: 'TXT One' }, fingerprint: 'txt-fingerprint', status: 'ready' }
const pdfLocation = { documentId: 'pdf-one', sectionId: 'page-2', sectionIndex: 1, progressPercent: 0, updatedAt: '2026-01-03T00:00:00.000Z', pdf: { mode: 'original' as const, zoomMode: 'custom' as const, zoom: 1.25, rotation: 90, pageNumber: 2 } }
const txtLocation = { documentId: 'txt-one', sectionId: 'section-1', sectionIndex: 0, progressPercent: 45, updatedAt: '2026-01-03T00:00:00.000Z' }
const pdfActivity: ReadingActivity = { key: 'imported:pdf-one', contentKind: 'imported', documentId: 'pdf-one', firstOpenedAt: '2026-01-01T00:00:00.000Z', lastOpenedAt: '2026-01-03T00:00:00.000Z', lastReadAt: '2026-01-03T00:00:00.000Z', sectionId: 'page-2', sectionIndex: 1, locationLabel: 'Page 2 of 8' }
const txtActivity: ReadingActivity = { key: 'imported:txt-one', contentKind: 'imported', documentId: 'txt-one', firstOpenedAt: '2026-01-02T00:00:00.000Z', lastOpenedAt: '2026-01-03T00:00:00.000Z', lastReadAt: '2026-01-03T00:00:00.000Z', sectionId: 'section-1', sectionIndex: 0, locationLabel: 'Section 1', progressPercent: 45 }

function transactionComplete(transaction: IDBTransaction): Promise<void> { return new Promise((resolve, reject) => { transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error ?? new Error('transaction error')); transaction.onabort = () => reject(transaction.error ?? new Error('transaction abort')) }) }
function openLegacyV3(factory: IDBFactory): Promise<IDBDatabase> { return new Promise((resolve, reject) => { const request = factory.open(databaseName, 3); request.onupgradeneeded = () => { const db = request.result; const documents = db.createObjectStore('documents', { keyPath: 'document.id' }); documents.createIndex('fingerprint', 'document.fingerprint', { unique: true }); db.createObjectStore('locations', { keyPath: 'documentId' }); const activity = db.createObjectStore('readingActivity', { keyPath: 'key' }); activity.createIndex('lastOpenedAt', 'lastOpenedAt'); activity.createIndex('lastReadAt', 'lastReadAt') }; request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); request.onblocked = () => reject(new Error('legacy open blocked')) }) }
function legacyRecord(document: ImportedDocument, sectionId: string, text: string, capabilities?: Partial<StoredDocument['capabilities']>) { return { document, source: new Blob([text]), sections: [{ id: sectionId, order: 0, content: [text] }], capabilities } }

describe('document repositories and IndexedDB migration', () => {
  let factory: IDBFactory
  let database: IDBDatabase | undefined
  afterEach(() => { database?.close(); database = undefined })

  it('stores documents, duplicate fingerprints, and locations in memory', async () => {
    const { MemoryDocumentRepository } = await import('./document-repository'); const repository = new MemoryDocumentRepository(); const record: StoredDocument = { document: txtDocument, source: new Blob(['one']), capabilities: { reflowable: true, supportsOriginalLayout: false, supportsTextSelection: true, supportsSearch: false, supportsTableOfContents: false, supportsPagination: false, supportsReadAloud: false }, sections: [{ id: 's', order: 0, blocks: [{ id: 'p', type: 'paragraph', text: 'one', order: 0 }] }] }
    await repository.saveDocument(record); await repository.saveLocation(txtLocation); await expect(repository.hasDocument('txt-fingerprint')).resolves.toBe(true); await expect(repository.saveDocument(record)).rejects.toMatchObject({ code: 'duplicate-document' }); await expect(repository.listLocations()).resolves.toHaveLength(1)
  })

  it('opens v4 stores and reads current records', async () => {
    factory = new IDBFactory(); Object.assign(globalThis, { indexedDB: factory, window: globalThis }); const repository = new IndexedDbDocumentRepository(); const record: StoredDocument = { document: txtDocument, source: new Blob(['one']), capabilities: { reflowable: true, supportsOriginalLayout: false, supportsTextSelection: true, supportsSearch: false, supportsTableOfContents: false, supportsPagination: false, supportsReadAloud: false }, sections: [{ id: 's', order: 0, blocks: [{ id: 'p', type: 'paragraph', text: 'one', order: 0 }] }] }
    await repository.saveDocument(record); await repository.saveLocation(txtLocation); await expect(repository.getDocument('txt-one')).resolves.toMatchObject({ sections: record.sections, capabilities: record.capabilities }); await expect(repository.listLocations()).resolves.toEqual([txtLocation]); expect(databaseVersion).toBe(4)
  })

  it('migrates v3 PDF, TXT, locations, and reading activity exactly once into v4', async () => {
    factory = new IDBFactory(); Object.assign(globalThis, { indexedDB: factory, window: globalThis }); database = await openLegacyV3(factory)
    try { const transaction = database.transaction(['documents', 'locations', 'readingActivity'], 'readwrite'); transaction.objectStore('documents').put(legacyRecord(pdfDocument, 'page-2', 'pdf paragraph', { reflowable: false, supportsTextSelection: false })); transaction.objectStore('documents').put(legacyRecord(txtDocument, 'section-1', 'txt paragraph', { reflowable: true })); transaction.objectStore('locations').put(pdfLocation); transaction.objectStore('locations').put(txtLocation); transaction.objectStore('readingActivity').put(pdfActivity); transaction.objectStore('readingActivity').put(txtActivity); await transactionComplete(transaction) } finally { database.close(); database = undefined }

    const documents = new IndexedDbDocumentRepository(); const activities = new IndexedDbReadingActivityRepository(); const migratedPdf = await documents.getDocument('pdf-one'); const migratedTxt = await documents.getDocument('txt-one'); expect(migratedPdf).toMatchObject({ document: pdfDocument, capabilities: { reflowable: false, supportsOriginalLayout: true, supportsTextSelection: false, supportsSearch: false, supportsTableOfContents: false, supportsPagination: false, supportsReadAloud: false }, sections: [{ blocks: [{ type: 'paragraph', text: 'pdf paragraph', order: 0 }] }] }); expect(migratedTxt).toMatchObject({ document: txtDocument, capabilities: { reflowable: true, supportsOriginalLayout: false }, sections: [{ blocks: [{ type: 'paragraph', text: 'txt paragraph', order: 0 }] }] }); await expect(documents.getLocation('pdf-one')).resolves.toEqual(pdfLocation); await expect(documents.getLocation('txt-one')).resolves.toEqual(txtLocation); await expect(activities.getActivity('imported', 'pdf-one')).resolves.toEqual(pdfActivity); await expect(activities.getActivity('imported', 'txt-one')).resolves.toEqual(txtActivity)

    const upgraded = await openDatabase(); database = upgraded; try { expect(upgraded.version).toBe(4); expect(upgraded.objectStoreNames.contains('documents')).toBe(true); expect(upgraded.objectStoreNames.contains('locations')).toBe(true); expect(upgraded.objectStoreNames.contains('readingActivity')).toBe(true); const activityTransaction = upgraded.transaction('readingActivity'); const activityStore = activityTransaction.objectStore('readingActivity'); const openedAt = requestResult(activityStore.index('lastOpenedAt').get('2026-01-03T00:00:00.000Z')); const readAt = requestResult(activityStore.index('lastReadAt').get('2026-01-03T00:00:00.000Z')); await expect(openedAt).resolves.toBeDefined(); await expect(readAt).resolves.toBeDefined() } finally { upgraded.close(); database = undefined }

    const reopened = await openDatabase(); database = reopened; try { const reopenedDocuments = new IndexedDbDocumentRepository(); expect(await reopenedDocuments.getDocument('pdf-one')).toMatchObject({ capabilities: { supportsOriginalLayout: true }, sections: [{ blocks: [{ text: 'pdf paragraph' }] }] }); expect(await reopenedDocuments.getLocation('pdf-one')).toEqual(pdfLocation); expect(await new IndexedDbReadingActivityRepository().getActivity('imported', 'txt-one')).toEqual(txtActivity) } finally { reopened.close(); database = undefined }
  })

  it('converts an aborted IndexedDB transaction into a storage error', async () => {
    factory = new IDBFactory(); Object.assign(globalThis, { indexedDB: factory, window: globalThis }); const originalTransaction = IDBDatabase.prototype.transaction; IDBDatabase.prototype.transaction = function abortingTransaction(this: IDBDatabase, storeNames: string | string[], mode?: IDBTransactionMode) { const transaction = originalTransaction.call(this, storeNames, mode); if (storeNames === 'locations' && mode === 'readwrite') queueMicrotask(() => transaction.abort()); return transaction }
    try { await expect(new IndexedDbDocumentRepository().saveLocation(txtLocation)).rejects.toMatchObject({ code: 'storage-failed' }) } finally { IDBDatabase.prototype.transaction = originalTransaction }
  })

  it('reports unavailable storage without leaking a platform error', async () => {
    factory = new IDBFactory(); Object.assign(globalThis, { indexedDB: factory, window: undefined }); try { await expect(new IndexedDbDocumentRepository().listDocuments()).rejects.toMatchObject({ code: 'storage-failed' }) } finally { Object.assign(globalThis, { window: globalThis }) }
  })
})
