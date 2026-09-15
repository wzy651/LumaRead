import { describe, expect, it } from 'vitest'
import type { ImportedDocument } from '../domain/documents'
import { IndexedDbDocumentRepository, MemoryDocumentRepository } from './document-repository'
const document: ImportedDocument = { id: 'one', format: 'txt', fileName: 'one.txt', fileSize: 3, importedAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', metadata: { title: 'One' }, fingerprint: 'fingerprint', status: 'ready' }
describe('document repositories', () => {
  it('stores documents, checks fingerprints, and restores locations in memory', async () => { const repository = new MemoryDocumentRepository(); await repository.saveDocument({ document, source: new Blob(['one']), sections: [{ id: 's', order: 0, content: ['one'] }] }); await repository.saveLocation({ documentId: 'one', sectionId: 's', sectionIndex: 0, progressPercent: 42, updatedAt: document.updatedAt }); await expect(repository.hasDocument('fingerprint')).resolves.toBe(true); await expect(repository.listDocuments()).resolves.toEqual([document]); await expect(repository.getLocation('one')).resolves.toMatchObject({ progressPercent: 42 }) })
  it('reports unavailable IndexedDB cleanly', async () => { await expect(new IndexedDbDocumentRepository().listDocuments()).rejects.toMatchObject({ code: 'storage-failed' }) })
})
