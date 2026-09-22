import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DocumentAdapter, DocumentCapabilities, DocumentSection, ImportedDocument, StoredDocument } from '../../../domain/documents'
import { MemoryDocumentRepository } from '../../../storage'
import { clearEpubContentUpgradeAttempts, ensureCurrentEpubContent } from './epub-content-upgrade'

const capabilities: DocumentCapabilities = { reflowable: true, supportsOriginalLayout: false, supportsTextSelection: true, supportsSearch: false, supportsTableOfContents: false, supportsPagination: false, supportsReadAloud: false, supportsInternalLinks: true }
const sections: DocumentSection[] = [{ id: 'new-section', order: 0, blocks: [{ id: 'new-block', type: 'paragraph', text: 'new content', order: 0 }] }]

function record(id: string, format: ImportedDocument['format'] = 'epub'): StoredDocument {
  return { document: { id, format, fileName: `${id}.${format}`, fileSize: 1, importedAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', metadata: { title: id }, fingerprint: id, status: 'ready' }, source: new Blob(['old']), sections: [{ id: 'old-section', order: 0, blocks: [{ id: 'old-block', type: 'paragraph', text: 'old content', order: 0 }] }], capabilities: { ...capabilities, supportsInternalLinks: false }, contentSchemaVersion: 1 }
}

function adapter(parse: DocumentAdapter['parse']): DocumentAdapter { return { format: 'epub', supports: vi.fn(), parse } }

describe('EPUB content upgrade service', () => {
  afterEach(() => clearEpubContentUpgradeAttempts())

  it('persists a successful upgrade and only parses one concurrent request', async () => {
    const repository = new MemoryDocumentRepository(); const input = record('upgrade-success'); await repository.saveDocument(input)
    const parse = vi.fn(async () => ({ metadata: input.document.metadata, sections, capabilities }))
    const contentAdapter = adapter(parse)
    const [first, second] = await Promise.all([ensureCurrentEpubContent(input, repository, contentAdapter), ensureCurrentEpubContent(input, repository, contentAdapter)])
    expect(parse).toHaveBeenCalledTimes(1); expect(first.status).toBe('upgraded'); expect(second.record.contentSchemaVersion).toBe(2); await expect(repository.getDocument(input.document.id)).resolves.toMatchObject({ contentSchemaVersion: 2, sections, capabilities: { supportsInternalLinks: true } })
  })

  it('keeps old content on parse failure without claiming the schema is current', async () => {
    const input = record('upgrade-parse-failure'); const repository = new MemoryDocumentRepository(); const contentAdapter = adapter(vi.fn().mockRejectedValue(new Error('bad epub')))
    const result = await ensureCurrentEpubContent(input, repository, contentAdapter)
    expect(result.status).toBe('parse-failed'); expect(result.record.sections).toEqual(input.sections); expect(result.record.contentSchemaVersion).toBe(1); expect(result.record.capabilities.supportsInternalLinks).toBe(false)
  })

  it('uses parsed content for this session when persistence rejects, without marking it current', async () => {
    const input = record('upgrade-storage-failure'); const repository = new MemoryDocumentRepository(); const update = vi.spyOn(repository, 'updateDocumentContent').mockRejectedValue(new Error('abort'))
    const result = await ensureCurrentEpubContent(input, repository, adapter(vi.fn().mockResolvedValue({ metadata: input.document.metadata, sections, capabilities })))
    expect(result.status).toBe('storage-failed'); expect(result.record.sections).toEqual(sections); expect(result.record.contentSchemaVersion).toBe(1); expect(update).toHaveBeenCalledTimes(1)
  })

  it('does not parse non-EPUB or already-current records', async () => {
    const parse = vi.fn(); const contentAdapter = adapter(parse); const txt = record('upgrade-txt', 'txt'); const current = { ...record('upgrade-current'), contentSchemaVersion: 2 }
    expect((await ensureCurrentEpubContent(txt, new MemoryDocumentRepository(), contentAdapter)).status).toBe('current'); expect((await ensureCurrentEpubContent(current, new MemoryDocumentRepository(), contentAdapter)).status).toBe('current'); expect(parse).not.toHaveBeenCalled()
  })
})
