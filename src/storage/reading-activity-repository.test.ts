import { indexedDB } from 'fake-indexeddb'
import { afterEach, describe, expect, it } from 'vitest'
import { databaseName } from './document-repository'
import { IndexedDbReadingActivityRepository, MemoryReadingActivityRepository } from './reading-activity-repository'
Object.assign(globalThis, { indexedDB, window: globalThis })
function clearDatabase() { return new Promise<void>((resolve) => { const request = indexedDB.deleteDatabase(databaseName); request.onsuccess = () => resolve() }) }
afterEach(clearDatabase)
describe('reading activity repository', () => {
  it('preserves first open and keeps builtin/imported ids distinct', async () => { const repository = new MemoryReadingActivityRepository(); await repository.recordOpen('builtin', 'same', '2026-01-01T00:00:00.000Z'); const result = await repository.recordProgress({ contentKind: 'builtin', documentId: 'same', lastReadAt: '2026-01-02T00:00:00.000Z', locationLabel: 'Chapter 2', progressPercent: 20 }); await repository.recordOpen('imported', 'same'); expect(result).toMatchObject({ key: 'builtin:same', firstOpenedAt: '2026-01-01T00:00:00.000Z' }); await expect(repository.listActivities()).resolves.toHaveLength(2) })
  it('writes and reads activity in IndexedDB without an inactive transaction', async () => { const repository = new IndexedDbReadingActivityRepository(); await repository.recordOpen('imported', 'file', '2026-01-01T00:00:00.000Z'); await repository.recordProgress({ contentKind: 'imported', documentId: 'file', lastReadAt: '2026-01-02T00:00:00.000Z', locationLabel: 'Page 2 of 10' }); await expect(repository.getActivity('imported', 'file')).resolves.toMatchObject({ firstOpenedAt: '2026-01-01T00:00:00.000Z', locationLabel: 'Page 2 of 10' }) })
})
