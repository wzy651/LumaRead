// @vitest-environment jsdom
import { IDBFactory } from 'fake-indexeddb'
import { afterEach, describe, expect, it } from 'vitest'
import { IndexedDbAnnotationRepository, MemoryAnnotationRepository } from './annotation-repository'
import { databaseName } from './database'

const input = { resourceKey: 'imported:book', quote: 'Hello', color: 'lavender' as const, segments: [{ sectionId: 's', sectionIndex: 0, blockId: 'b', startOffset: 0, endOffset: 5, exact: 'Hello', prefix: '', suffix: ' world' }] }

describe('annotation repositories', () => {
  afterEach(() => { Object.assign(globalThis, { indexedDB: new IDBFactory(), window: globalThis }) })
  it('supports memory CRUD, deduplication, patches, and document deletion', async () => {
    const repository = new MemoryAnnotationRepository(); const first = await repository.add(input); const duplicate = await repository.add({ ...input, id: 'duplicate' }); expect(duplicate).toEqual(first)
    await expect(repository.update(first.id, { note: 'A note', color: 'sage' })).resolves.toMatchObject({ note: 'A note', color: 'sage' }); expect(await repository.get(first.id)).toMatchObject({ note: 'A note' }); await repository.deleteForResource(input.resourceKey); await expect(repository.listForResource(input.resourceKey)).resolves.toEqual([])
  })
  it('persists IndexedDB writes, indexes annotations, and deduplicates concurrent adds', async () => {
    const factory = new IDBFactory(); Object.assign(globalThis, { indexedDB: factory, window: globalThis }); const repository = new IndexedDbAnnotationRepository(); const [first, second] = await Promise.all([repository.add(input), repository.add({ ...input, id: 'concurrent' })]); expect(second).toEqual(first); expect(await repository.listForResource(input.resourceKey)).toHaveLength(1)
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = factory.open(databaseName); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) }); expect([...db.transaction('annotations').objectStore('annotations').indexNames]).toEqual(expect.arrayContaining(['resourceKey', 'createdAt', 'updatedAt', 'anchorKey', 'resourceAnchor'])); db.close()
  })
})
