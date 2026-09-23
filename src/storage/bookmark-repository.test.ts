// @vitest-environment jsdom
import { IDBDatabase, IDBFactory } from 'fake-indexeddb'
import { afterEach, describe, expect, it } from 'vitest'
import type { BookmarkInput } from '../domain'
import { IndexedDbBookmarkRepository, MemoryBookmarkRepository } from './bookmark-repository'
import { databaseName, openDatabase, requestResult } from './database'

const locator = { version: 1 as const, kind: 'reflowable' as const, resourceKey: 'imported:book', sectionId: 'section-1', sectionIndex: 0, blockId: 'block-1' }
const input: BookmarkInput = { resourceKey: locator.resourceKey, locator, label: 'Section 1', excerpt: 'A short excerpt.' }

function openV4(factory: IDBFactory): Promise<IDBDatabase> { return new Promise((resolve, reject) => { const request = factory.open(databaseName, 4); request.onupgradeneeded = () => { const db = request.result; const documents = db.createObjectStore('documents', { keyPath: 'document.id' }); documents.createIndex('fingerprint', 'document.fingerprint', { unique: true }); db.createObjectStore('locations', { keyPath: 'documentId' }); const activity = db.createObjectStore('readingActivity', { keyPath: 'key' }); activity.createIndex('lastOpenedAt', 'lastOpenedAt'); activity.createIndex('lastReadAt', 'lastReadAt') }; request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) }) }

describe('bookmark repositories', () => {
  let database: IDBDatabase | undefined
  afterEach(() => { database?.close(); database = undefined })

  it('deduplicates and toggles the same normalized position in memory', async () => {
    const repository = new MemoryBookmarkRepository()
    const first = await repository.add({ ...input, anchorKey: 'stale-non-canonical-key' })
    const duplicate = await repository.add({ ...input, id: 'different-id', locator: { ...locator, sectionId: ' section-1 ', sectionIndex: 0.4 } })
    expect(duplicate).toEqual(first)
    expect(first.anchorKey).toContain('imported:book')
    await expect(repository.listForResource(locator.resourceKey)).resolves.toHaveLength(1)
    await repository.toggleAtLocator(input)
    await expect(repository.listForResource(locator.resourceKey)).resolves.toHaveLength(0)
  })

  it('scopes bookmark queries by resource even when anchor keys are globally indexed', async () => {
    const repository = new MemoryBookmarkRepository()
    const saved = await repository.add(input)
    expect(await repository.findByAnchor('imported:other', saved.anchorKey)).toBeUndefined()
    await repository.add({ ...input, resourceKey: 'imported:other', locator: { ...locator, resourceKey: 'imported:other' } })
    expect(await repository.listForResource(locator.resourceKey)).toHaveLength(1)
    expect(await repository.listForResource('imported:other')).toHaveLength(1)
  })

  it('waits for IndexedDB writes and preserves v5 data while adding the v7 store', async () => {
    const factory = new IDBFactory(); Object.assign(globalThis, { indexedDB: factory, window: globalThis }); database = await openV4(factory)
    const transaction = database.transaction('locations', 'readwrite'); transaction.objectStore('locations').put({ documentId: 'book', sectionId: 'section-1', sectionIndex: 0, progressPercent: 5, updatedAt: '2026-01-01T00:00:00.000Z' }); await new Promise<void>((resolve, reject) => { transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error) }); database.close(); database = undefined
    const repository = new IndexedDbBookmarkRepository(); const [saved, duplicate] = await Promise.all([repository.add(input), repository.add({ ...input, id: 'concurrent-duplicate' })]); expect(saved.anchorKey).toContain('block-1'); expect(duplicate.anchorKey).toBe(saved.anchorKey); await expect(repository.findByAnchor(locator.resourceKey, saved.anchorKey)).resolves.toEqual(saved)
    const upgraded = await openDatabase(); database = upgraded; expect(upgraded.version).toBe(7); expect(upgraded.objectStoreNames.contains('bookmarks')).toBe(true); expect(upgraded.objectStoreNames.contains('annotations')).toBe(true); expect(await requestResult(upgraded.transaction('locations').objectStore('locations').get('book'))).toMatchObject({ documentId: 'book' })
    await repository.toggleAtLocator(input); await expect(repository.listForResource(locator.resourceKey)).resolves.toHaveLength(0)
  })

  it('converts a bookmark transaction abort into a safe storage error', async () => {
    const factory = new IDBFactory(); Object.assign(globalThis, { indexedDB: factory, window: globalThis })
    const originalTransaction = IDBDatabase.prototype.transaction
    IDBDatabase.prototype.transaction = function abortingTransaction(this: IDBDatabase, storeNames: string | string[], mode?: IDBTransactionMode) {
      const transaction = originalTransaction.call(this, storeNames, mode)
      if (storeNames === 'bookmarks' && mode === 'readwrite') queueMicrotask(() => transaction.abort())
      return transaction
    }
    try { await expect(new IndexedDbBookmarkRepository().add(input)).rejects.toMatchObject({ code: 'storage-failed' }) } finally { IDBDatabase.prototype.transaction = originalTransaction }
  })
})
