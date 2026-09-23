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
const epubDocument: ImportedDocument = { id: 'epub-one', format: 'epub', fileName: 'one.epub', fileSize: 4, importedAt: '2026-01-03T00:00:00.000Z', updatedAt: '2026-01-03T00:00:00.000Z', metadata: { title: 'EPUB One' }, fingerprint: 'epub-fingerprint', status: 'ready' }
const docxDocument: ImportedDocument = { id: 'docx-one', format: 'docx', fileName: 'one.docx', fileSize: 5, importedAt: '2026-01-04T00:00:00.000Z', updatedAt: '2026-01-04T00:00:00.000Z', metadata: { title: 'DOCX One' }, fingerprint: 'docx-fingerprint', status: 'ready' }
const pdfLocation = { documentId: 'pdf-one', sectionId: 'page-2', sectionIndex: 1, progressPercent: 0, updatedAt: '2026-01-03T00:00:00.000Z', pdf: { mode: 'original' as const, zoomMode: 'custom' as const, zoom: 1.25, rotation: 90, pageNumber: 2 } }
const txtLocation = { documentId: 'txt-one', sectionId: 'section-1', sectionIndex: 0, progressPercent: 45, updatedAt: '2026-01-03T00:00:00.000Z' }
const pdfActivity: ReadingActivity = { key: 'imported:pdf-one', contentKind: 'imported', documentId: 'pdf-one', firstOpenedAt: '2026-01-01T00:00:00.000Z', lastOpenedAt: '2026-01-03T00:00:00.000Z', lastReadAt: '2026-01-03T00:00:00.000Z', sectionId: 'page-2', sectionIndex: 1, locationLabel: 'Page 2 of 8' }
const txtActivity: ReadingActivity = { key: 'imported:txt-one', contentKind: 'imported', documentId: 'txt-one', firstOpenedAt: '2026-01-02T00:00:00.000Z', lastOpenedAt: '2026-01-03T00:00:00.000Z', lastReadAt: '2026-01-03T00:00:00.000Z', sectionId: 'section-1', sectionIndex: 0, locationLabel: 'Section 1', progressPercent: 45 }

function transactionComplete(transaction: IDBTransaction): Promise<void> { return new Promise((resolve, reject) => { transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error ?? new Error('transaction error')); transaction.onabort = () => reject(transaction.error ?? new Error('transaction abort')) }) }
function openLegacyV3(factory: IDBFactory): Promise<IDBDatabase> { return new Promise((resolve, reject) => { const request = factory.open(databaseName, 3); request.onupgradeneeded = () => { const db = request.result; const documents = db.createObjectStore('documents', { keyPath: 'document.id' }); documents.createIndex('fingerprint', 'document.fingerprint', { unique: true }); db.createObjectStore('locations', { keyPath: 'documentId' }); const activity = db.createObjectStore('readingActivity', { keyPath: 'key' }); activity.createIndex('lastOpenedAt', 'lastOpenedAt'); activity.createIndex('lastReadAt', 'lastReadAt') }; request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); request.onblocked = () => reject(new Error('legacy open blocked')) }) }
function openLegacyV4(factory: IDBFactory): Promise<IDBDatabase> { return new Promise((resolve, reject) => { const request = factory.open(databaseName, 4); request.onupgradeneeded = () => { const db = request.result; const documents = db.createObjectStore('documents', { keyPath: 'document.id' }); documents.createIndex('fingerprint', 'document.fingerprint', { unique: true }); db.createObjectStore('locations', { keyPath: 'documentId' }); const activity = db.createObjectStore('readingActivity', { keyPath: 'key' }); activity.createIndex('lastOpenedAt', 'lastOpenedAt'); activity.createIndex('lastReadAt', 'lastReadAt') }; request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); request.onblocked = () => reject(new Error('legacy open blocked')) }) }
function openLegacyV5(factory: IDBFactory): Promise<IDBDatabase> { return new Promise((resolve, reject) => { const request = factory.open(databaseName, 5); request.onupgradeneeded = () => { const db = request.result; const documents = db.createObjectStore('documents', { keyPath: 'document.id' }); documents.createIndex('fingerprint', 'document.fingerprint', { unique: true }); db.createObjectStore('locations', { keyPath: 'documentId' }); const activity = db.createObjectStore('readingActivity', { keyPath: 'key' }); activity.createIndex('lastOpenedAt', 'lastOpenedAt'); activity.createIndex('lastReadAt', 'lastReadAt'); const bookmarks = db.createObjectStore('bookmarks', { keyPath: 'id' }); bookmarks.createIndex('resourceKey', 'resourceKey'); bookmarks.createIndex('createdAt', 'createdAt'); bookmarks.createIndex('updatedAt', 'updatedAt'); bookmarks.createIndex('anchorKey', 'anchorKey', { unique: true }) }; request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); request.onblocked = () => reject(new Error('legacy open blocked')) }) }
function legacyRecord(document: ImportedDocument, sectionId: string, text: string, capabilities?: Partial<StoredDocument['capabilities']>) { return { document, source: new Blob([text]), sections: [{ id: sectionId, order: 0, content: [text] }], capabilities } }
function v4Record(document: ImportedDocument, sectionId: string, text: string, capabilities: StoredDocument['capabilities']): StoredDocument { return { document, source: new Blob([text]), sections: [{ id: sectionId, title: sectionId, order: 0, blocks: [{ id: `${sectionId}-block`, type: 'paragraph', text, order: 0 }] }], capabilities } }

describe('document repositories and IndexedDB migration', () => {
  let factory: IDBFactory
  let database: IDBDatabase | undefined
  afterEach(() => { database?.close(); database = undefined })

  it('stores documents, duplicate fingerprints, and locations in memory', async () => {
    const { MemoryDocumentRepository } = await import('./document-repository'); const repository = new MemoryDocumentRepository(); const record: StoredDocument = { document: txtDocument, source: new Blob(['one']), capabilities: { reflowable: true, supportsOriginalLayout: false, supportsTextSelection: true, supportsSearch: false, supportsTableOfContents: false, supportsPagination: false, supportsReadAloud: false }, sections: [{ id: 's', order: 0, blocks: [{ id: 'p', type: 'paragraph', text: 'one', order: 0 }] }] }
    await repository.saveDocument(record); await repository.saveLocation(txtLocation); await expect(repository.hasDocument('txt-fingerprint')).resolves.toBe(true); await expect(repository.saveDocument(record)).rejects.toMatchObject({ code: 'duplicate-document' }); await expect(repository.listLocations()).resolves.toHaveLength(1)
  })

  it('opens v7 stores and reads current records', async () => {
    factory = new IDBFactory(); Object.assign(globalThis, { indexedDB: factory, window: globalThis }); const repository = new IndexedDbDocumentRepository(); const record: StoredDocument = { document: txtDocument, source: new Blob(['one']), capabilities: { reflowable: true, supportsOriginalLayout: false, supportsTextSelection: true, supportsSearch: false, supportsTableOfContents: false, supportsPagination: false, supportsReadAloud: false }, sections: [{ id: 's', order: 0, blocks: [{ id: 'p', type: 'paragraph', text: 'one', order: 0 }] }] }
    await repository.saveDocument(record); await repository.saveLocation(txtLocation); await expect(repository.getDocument('txt-one')).resolves.toMatchObject({ sections: record.sections, capabilities: record.capabilities }); await expect(repository.listLocations()).resolves.toEqual([txtLocation]); expect(databaseVersion).toBe(7)
  })

  it('migrates v3 PDF, TXT, locations, and reading activity exactly once into v7', async () => {
    factory = new IDBFactory(); Object.assign(globalThis, { indexedDB: factory, window: globalThis }); database = await openLegacyV3(factory)
    try { const transaction = database.transaction(['documents', 'locations', 'readingActivity'], 'readwrite'); transaction.objectStore('documents').put(legacyRecord(pdfDocument, 'page-2', 'pdf paragraph', { reflowable: false, supportsTextSelection: false })); transaction.objectStore('documents').put(legacyRecord(txtDocument, 'section-1', 'txt paragraph', { reflowable: true })); transaction.objectStore('locations').put(pdfLocation); transaction.objectStore('locations').put(txtLocation); transaction.objectStore('readingActivity').put(pdfActivity); transaction.objectStore('readingActivity').put(txtActivity); await transactionComplete(transaction) } finally { database.close(); database = undefined }

    const documents = new IndexedDbDocumentRepository(); const activities = new IndexedDbReadingActivityRepository(); const migratedPdf = await documents.getDocument('pdf-one'); const migratedTxt = await documents.getDocument('txt-one'); expect(migratedPdf).toMatchObject({ document: pdfDocument, capabilities: { reflowable: false, supportsOriginalLayout: true, supportsTextSelection: false, supportsSearch: false, supportsTableOfContents: false, supportsPagination: false, supportsReadAloud: false }, sections: [{ blocks: [{ type: 'paragraph', text: 'pdf paragraph', order: 0 }] }] }); expect(migratedTxt).toMatchObject({ document: txtDocument, capabilities: { reflowable: true, supportsOriginalLayout: false }, sections: [{ blocks: [{ type: 'paragraph', text: 'txt paragraph', order: 0 }] }] }); await expect(documents.getLocation('pdf-one')).resolves.toEqual(pdfLocation); await expect(documents.getLocation('txt-one')).resolves.toEqual(txtLocation); await expect(activities.getActivity('imported', 'pdf-one')).resolves.toEqual(pdfActivity); await expect(activities.getActivity('imported', 'txt-one')).resolves.toEqual(txtActivity)

    const upgraded = await openDatabase(); database = upgraded; try { expect(upgraded.version).toBe(7); expect(upgraded.objectStoreNames.contains('documents')).toBe(true); expect(upgraded.objectStoreNames.contains('locations')).toBe(true); expect(upgraded.objectStoreNames.contains('readingActivity')).toBe(true); expect(upgraded.objectStoreNames.contains('bookmarks')).toBe(true); expect(upgraded.objectStoreNames.contains('annotations')).toBe(true); const bookmarkStore = upgraded.transaction('bookmarks').objectStore('bookmarks'); expect(bookmarkStore.indexNames.contains('resourceKey')).toBe(true); expect(bookmarkStore.indexNames.contains('createdAt')).toBe(true); expect(bookmarkStore.indexNames.contains('updatedAt')).toBe(true); expect(bookmarkStore.indexNames.contains('anchorKey')).toBe(true); const activityTransaction = upgraded.transaction('readingActivity'); const activityStore = activityTransaction.objectStore('readingActivity'); const openedAt = requestResult(activityStore.index('lastOpenedAt').get('2026-01-03T00:00:00.000Z')); const readAt = requestResult(activityStore.index('lastReadAt').get('2026-01-03T00:00:00.000Z')); await expect(openedAt).resolves.toBeDefined(); await expect(readAt).resolves.toBeDefined() } finally { upgraded.close(); database = undefined }

    const reopened = await openDatabase(); database = reopened; try { const reopenedDocuments = new IndexedDbDocumentRepository(); expect(await reopenedDocuments.getDocument('pdf-one')).toMatchObject({ capabilities: { supportsOriginalLayout: true }, sections: [{ blocks: [{ text: 'pdf paragraph' }] }] }); expect(await reopenedDocuments.getLocation('pdf-one')).toEqual(pdfLocation); expect(await new IndexedDbReadingActivityRepository().getActivity('imported', 'txt-one')).toEqual(txtActivity) } finally { reopened.close(); database = undefined }
  })

  it('migrates a real v4 database with all current data into v7 without repeating the migration', async () => {
    factory = new IDBFactory(); Object.assign(globalThis, { indexedDB: factory, window: globalThis }); database = await openLegacyV4(factory)
    const v4Capabilities = (reflowable: boolean, supportsOriginalLayout: boolean): StoredDocument['capabilities'] => ({ reflowable, supportsOriginalLayout, supportsTextSelection: true, supportsSearch: false, supportsTableOfContents: reflowable, supportsPagination: !reflowable, supportsReadAloud: false })
    const records = [
      v4Record(pdfDocument, 'page-2', 'pdf paragraph', v4Capabilities(false, true)),
      v4Record(txtDocument, 'txt-section', 'txt paragraph', v4Capabilities(true, false)),
      v4Record(epubDocument, 'epub-chapter', 'epub paragraph', v4Capabilities(true, false)),
      v4Record(docxDocument, 'docx-section', 'docx paragraph', v4Capabilities(true, false)),
    ]
    const v4Location = { documentId: 'epub-one', sectionId: 'epub-chapter', sectionIndex: 0, progressPercent: 37, updatedAt: '2026-01-05T00:00:00.000Z' }
    const v4Activity: ReadingActivity = { key: 'imported:epub-one', contentKind: 'imported', documentId: 'epub-one', firstOpenedAt: '2026-01-03T00:00:00.000Z', lastOpenedAt: '2026-01-05T00:00:00.000Z', lastReadAt: '2026-01-05T00:00:00.000Z', sectionId: 'epub-chapter', sectionIndex: 0, locationLabel: 'epub-chapter', progressPercent: 37 }
    try {
      const transaction = database.transaction(['documents', 'locations', 'readingActivity'], 'readwrite')
      for (const record of records) transaction.objectStore('documents').put(record)
      transaction.objectStore('locations').put(v4Location)
      transaction.objectStore('readingActivity').put(v4Activity)
      await transactionComplete(transaction)
    } finally { database.close(); database = undefined }

    const upgraded = await openDatabase(); database = upgraded
    try {
      expect(upgraded.version).toBe(7)
      expect(upgraded.objectStoreNames.contains('bookmarks')).toBe(true)
      const bookmarkStore = upgraded.transaction('bookmarks').objectStore('bookmarks')
      expect([...bookmarkStore.indexNames]).toEqual(expect.arrayContaining(['resourceKey', 'createdAt', 'updatedAt', 'anchorKey']))
      expect(await requestResult(upgraded.transaction('documents').objectStore('documents').index('fingerprint').getKey('pdf-fingerprint'))).toBe('pdf-one')
      expect(await requestResult(upgraded.transaction('readingActivity').objectStore('readingActivity').index('lastReadAt').get('2026-01-05T00:00:00.000Z'))).toEqual(v4Activity)
      expect(await requestResult(upgraded.transaction('locations').objectStore('locations').get('epub-one'))).toEqual(v4Location)
      const migratedPdf = await requestResult(upgraded.transaction('documents').objectStore('documents').get('pdf-one')) as StoredDocument
      expect(migratedPdf).toMatchObject({ document: records[0].document, sections: records[0].sections, capabilities: records[0].capabilities })
      expect(migratedPdf.source).toBeDefined()
      expect(await requestResult(upgraded.transaction('documents').objectStore('documents').getAll())).toHaveLength(4)
    } finally { upgraded.close(); database = undefined }

    const reopened = await openDatabase(); database = reopened
    try {
      expect(await requestResult(reopened.transaction('documents').objectStore('documents').getAll())).toHaveLength(4)
      expect(await requestResult(reopened.transaction('locations').objectStore('locations').get('epub-one'))).toEqual(v4Location)
      expect(await requestResult(reopened.transaction('readingActivity').objectStore('readingActivity').get('imported:epub-one'))).toEqual(v4Activity)
    } finally { reopened.close(); database = undefined }
  })

  it('migrates v5 content metadata to v7 while preserving all existing stores and indexes', async () => {
    factory = new IDBFactory(); Object.assign(globalThis, { indexedDB: factory, window: globalThis }); database = await openLegacyV5(factory)
    const legacyEpub = { ...v4Record(epubDocument, 'chapter', 'old epub', { reflowable: true, supportsOriginalLayout: false, supportsTextSelection: true, supportsSearch: false, supportsTableOfContents: true, supportsPagination: false, supportsReadAloud: false, supportsInternalLinks: true }), contentSchemaVersion: 1 }
    const legacyBookmark = { id: 'bookmark-v5', resourceKey: 'imported:epub-one', anchorKey: 'anchor-v5', locator: { version: 1, kind: 'reflowable', resourceKey: 'imported:epub-one', sectionId: 'chapter', sectionIndex: 0 }, label: 'Chapter', createdAt: '2026-01-06T00:00:00.000Z', updatedAt: '2026-01-06T00:00:00.000Z' }
    try { const transaction = database.transaction(['documents', 'locations', 'readingActivity', 'bookmarks'], 'readwrite'); transaction.objectStore('documents').put(legacyEpub); transaction.objectStore('locations').put({ documentId: 'epub-one', sectionId: 'chapter', sectionIndex: 0, progressPercent: 21, updatedAt: '2026-01-06T00:00:00.000Z' }); transaction.objectStore('readingActivity').put({ key: 'imported:epub-one', contentKind: 'imported', documentId: 'epub-one', firstOpenedAt: '2026-01-01T00:00:00.000Z', lastOpenedAt: '2026-01-06T00:00:00.000Z' }); transaction.objectStore('bookmarks').put(legacyBookmark); await transactionComplete(transaction) } finally { database.close(); database = undefined }
    const upgraded = await openDatabase(); database = upgraded
    try { const migrated = await requestResult(upgraded.transaction('documents').objectStore('documents').get('epub-one')) as StoredDocument; expect(upgraded.version).toBe(7); expect(migrated.contentSchemaVersion).toBe(1); expect(migrated.capabilities.supportsInternalLinks).toBe(false); expect(await requestResult(upgraded.transaction('locations').objectStore('locations').get('epub-one'))).toMatchObject({ progressPercent: 21 }); expect(await requestResult(upgraded.transaction('readingActivity').objectStore('readingActivity').get('imported:epub-one'))).toBeDefined(); expect(await requestResult(upgraded.transaction('bookmarks').objectStore('bookmarks').get('bookmark-v5'))).toEqual(legacyBookmark); expect([...upgraded.transaction('bookmarks').objectStore('bookmarks').indexNames]).toEqual(expect.arrayContaining(['resourceKey', 'createdAt', 'updatedAt', 'anchorKey'])) } finally { upgraded.close(); database = undefined }
    const reopened = await openDatabase(); database = reopened; try { expect(await requestResult(reopened.transaction('documents').objectStore('documents').get('epub-one'))).toMatchObject({ contentSchemaVersion: 1, capabilities: { supportsInternalLinks: false } }) } finally { reopened.close(); database = undefined }
  })

  it('converts an aborted IndexedDB transaction into a storage error', async () => {
    factory = new IDBFactory(); Object.assign(globalThis, { indexedDB: factory, window: globalThis }); const originalTransaction = IDBDatabase.prototype.transaction; IDBDatabase.prototype.transaction = function abortingTransaction(this: IDBDatabase, storeNames: string | string[], mode?: IDBTransactionMode) { const transaction = originalTransaction.call(this, storeNames, mode); if (storeNames === 'locations' && mode === 'readwrite') queueMicrotask(() => transaction.abort()); return transaction }
    try { await expect(new IndexedDbDocumentRepository().saveLocation(txtLocation)).rejects.toMatchObject({ code: 'storage-failed' }) } finally { IDBDatabase.prototype.transaction = originalTransaction }
  })

  it('reports unavailable storage without leaking a platform error', async () => {
    factory = new IDBFactory(); Object.assign(globalThis, { indexedDB: factory, window: undefined }); try { await expect(new IndexedDbDocumentRepository().listDocuments()).rejects.toMatchObject({ code: 'storage-failed' }) } finally { Object.assign(globalThis, { window: globalThis }) }
  })
})
