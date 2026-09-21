// @vitest-environment jsdom
import { IDBFactory } from 'fake-indexeddb'
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
    const first = await repository.add(input)
    const duplicate = await repository.add({ ...input, id: 'different-id' })
    expect(duplicate).toEqual(first)
    await expect(repository.listForResource(locator.resourceKey)).resolves.toHaveLength(1)
    await repository.toggleAtLocator(input)
    await expect(repository.listForResource(locator.resourceKey)).resolves.toHaveLength(0)
  })

  it('waits for IndexedDB writes and preserves v4 data while adding the v5 store', async () => {
    const factory = new IDBFactory(); Object.assign(globalThis, { indexedDB: factory, window: globalThis }); database = await openV4(factory)
    const transaction = database.transaction('locations', 'readwrite'); transaction.objectStore('locations').put({ documentId: 'book', sectionId: 'section-1', sectionIndex: 0, progressPercent: 5, updatedAt: '2026-01-01T00:00:00.000Z' }); await new Promise<void>((resolve, reject) => { transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error) }); database.close(); database = undefined
    const repository = new IndexedDbBookmarkRepository(); const [saved, duplicate] = await Promise.all([repository.add(input), repository.add({ ...input, id: 'concurrent-duplicate' })]); expect(saved.anchorKey).toContain('block-1'); expect(duplicate.anchorKey).toBe(saved.anchorKey); await expect(repository.findByAnchor(locator.resourceKey, saved.anchorKey)).resolves.toEqual(saved)
    const upgraded = await openDatabase(); database = upgraded; expect(upgraded.version).toBe(5); expect(upgraded.objectStoreNames.contains('bookmarks')).toBe(true); expect(await requestResult(upgraded.transaction('locations').objectStore('locations').get('book'))).toMatchObject({ documentId: 'book' })
    await repository.toggleAtLocator(input); await expect(repository.listForResource(locator.resourceKey)).resolves.toHaveLength(0)
  })
})
