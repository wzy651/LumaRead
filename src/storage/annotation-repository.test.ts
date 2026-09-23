// @vitest-environment jsdom
import { IDBDatabase, IDBFactory } from 'fake-indexeddb'
import { afterEach, describe, expect, it } from 'vitest'
import { IndexedDbAnnotationRepository, MemoryAnnotationRepository } from './annotation-repository'
import { databaseName } from './database'
import { annotationAnchorKey } from '../domain/annotation'

const input = { resourceKey: 'imported:book', quote: 'Hello', color: 'lavender' as const, segments: [{ sectionId: 's', sectionIndex: 0, blockId: 'b', startOffset: 0, endOffset: 5, exact: 'Hello', prefix: '', suffix: ' world' }] }

describe('annotation repositories', () => {
  afterEach(() => { Object.assign(globalThis, { indexedDB: new IDBFactory(), window: globalThis }) })
  it('supports memory CRUD, deduplication, patches, and document deletion', async () => {
    const repository = new MemoryAnnotationRepository(); const first = await repository.add({ ...input, anchorKey: 'caller-forged-key' }); const duplicate = await repository.add({ ...input, id: 'duplicate', anchorKey: 'also-forged' }); expect(duplicate).toEqual(first); expect(first.anchorKey).toBe(annotationAnchorKey(input.segments))
    await expect(repository.update(first.id, { note: 'A note', color: 'sage' })).resolves.toMatchObject({ note: 'A note', color: 'sage' }); expect(await repository.get(first.id)).toMatchObject({ note: 'A note' }); await repository.deleteForResource(input.resourceKey); await expect(repository.listForResource(input.resourceKey)).resolves.toEqual([])
  })
  it('deduplicates concurrent memory adds while isolating equal anchors across resources', async () => {
    const repository = new MemoryAnnotationRepository(); const [first, second] = await Promise.all([repository.add(input), repository.add({ ...input, id: 'racing-copy' })]); expect(first).toEqual(second)
    const other = await repository.add({ ...input, resourceKey: 'imported:other' }); expect(other.id).not.toBe(first.id); expect(await repository.findByAnchor('imported:other', other.anchorKey)).toEqual(other); await repository.remove(first.id); expect(await repository.get(first.id)).toBeUndefined(); expect(await repository.get(other.id)).toEqual(other)
  })
  it('sorts by section, numeric block order, offset, then creation time', async () => {
    const repository = new MemoryAnnotationRepository(); const items = [
      { ...input, id: 'block-two', segments: [{ ...input.segments[0], sectionIndex: 0, blockId: 'block-2', blockOrder: 2, startOffset: 0 }] },
      { ...input, id: 'block-one', segments: [{ ...input.segments[0], sectionIndex: 0, blockId: 'block-10', blockOrder: 1, startOffset: 0 }] },
      { ...input, id: 'block-zero-late', segments: [{ ...input.segments[0], sectionIndex: 0, blockId: 'block-9', blockOrder: 0, startOffset: 8 }] },
      { ...input, id: 'block-zero-early', segments: [{ ...input.segments[0], sectionIndex: 0, blockId: 'block-8', blockOrder: 0, startOffset: 2 }] },
      { ...input, id: 'next-section', segments: [{ ...input.segments[0], sectionId: 's2', sectionIndex: 1, blockId: 'block-0', blockOrder: 0, startOffset: 0 }] },
    ]
    for (const item of items) await repository.add(item)
    expect((await repository.listForResource(input.resourceKey)).map((item) => item.id)).toEqual(['block-zero-early', 'block-zero-late', 'block-one', 'block-two', 'next-section'])
  })
  it('persists IndexedDB writes, indexes annotations, and deduplicates concurrent adds', async () => {
    const factory = new IDBFactory(); Object.assign(globalThis, { indexedDB: factory, window: globalThis }); const repository = new IndexedDbAnnotationRepository(); const [first, second] = await Promise.all([repository.add(input), repository.add({ ...input, id: 'concurrent' })]); expect(second).toEqual(first); expect(await repository.listForResource(input.resourceKey)).toHaveLength(1)
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = factory.open(databaseName); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) }); expect([...db.transaction('annotations').objectStore('annotations').indexNames]).toEqual(expect.arrayContaining(['resourceKey', 'createdAt', 'updatedAt', 'anchorKey', 'resourceAnchor'])); db.close()
  })
  it('supports IndexedDB update, remove, resource isolation, and resource deletion', async () => {
    Object.assign(globalThis, { indexedDB: new IDBFactory(), window: globalThis }); const repository = new IndexedDbAnnotationRepository(); const first = await repository.add(input); const other = await repository.add({ ...input, resourceKey: 'imported:other' }); await expect(repository.update(first.id, { note: 'Updated' })).resolves.toMatchObject({ note: 'Updated' }); expect(await repository.findByAnchor('imported:other', other.anchorKey)).toEqual(other); await repository.deleteForResource(input.resourceKey); expect(await repository.listForResource(input.resourceKey)).toEqual([]); expect(await repository.get(other.id)).toEqual(other)
  })
  it('reports transaction aborts and failed writes as storage errors', async () => {
    Object.assign(globalThis, { indexedDB: new IDBFactory(), window: globalThis }); const repository = new IndexedDbAnnotationRepository(); const originalTransaction = IDBDatabase.prototype.transaction
    IDBDatabase.prototype.transaction = function abortAnnotationWrite(this: IDBDatabase, storeNames: string | string[], mode?: IDBTransactionMode) { const transaction = originalTransaction.call(this, storeNames, mode); if ((storeNames === 'annotations' || (Array.isArray(storeNames) && storeNames.includes('annotations'))) && mode === 'readwrite') queueMicrotask(() => transaction.abort()); return transaction }
    try { await expect(repository.add(input)).rejects.toMatchObject({ code: 'storage-failed' }) } finally { IDBDatabase.prototype.transaction = originalTransaction }
  })
})
