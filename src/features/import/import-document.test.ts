import { describe, expect, it, vi } from 'vitest'
import type { DocumentAdapter, DocumentFormat, DocumentSource } from '../../domain/documents'
import { MemoryDocumentRepository } from '../../storage'
import { importDocument } from './import-document'

const adapters = {} as Record<DocumentFormat, DocumentAdapter>
for (const format of ['txt', 'epub', 'pdf', 'docx'] as const) adapters[format] = {
  format,
  supports: vi.fn().mockResolvedValue(true),
  parse: vi.fn().mockResolvedValue({ metadata: { title: `${format} title` }, capabilities: { reflowable: true, supportsTextSelection: true, supportsSearch: false, supportsTableOfContents: format !== 'pdf', supportsPagination: format === 'pdf', supportsReadAloud: false }, sections: [{ id: `${format}-section`, order: 0, blocks: [{ id: `${format}-block`, type: 'paragraph', text: `${format} text`, order: 0 }] }] }),
}
vi.mock('../../document-adapters', () => ({ adapterFor: (format: DocumentFormat) => Promise.resolve(adapters[format]) }))

function source(format: DocumentFormat): DocumentSource { const contents = format === 'pdf' ? '%PDF- sample' : format === 'epub' || format === 'docx' ? 'PK sample' : 'txt contents'; const blob = new Blob([contents]); return { blob, fileName: `sample.${format}`, size: blob.size } }

describe('document import', () => {
  it.each(['txt', 'epub', 'pdf', 'docx'] as const)('persists parsed %s metadata, capabilities, and sections in memory', async (format) => {
    const repository = new MemoryDocumentRepository()
    const imported = await importDocument(source(format), repository)
    const stored = await repository.getDocument(imported.id)
    expect(imported.format).toBe(format)
    expect(stored).toMatchObject({ document: { metadata: { title: `${format} title` } }, capabilities: { reflowable: true, supportsSearch: true }, sections: [{ id: `${format}-section`, blocks: [{ text: `${format} text` }] }] })
  })

  it.each(['txt', 'epub', 'pdf', 'docx'] as const)('detects duplicate %s content by SHA-256', async (format) => {
    const repository = new MemoryDocumentRepository(); const document = source(format)
    await importDocument(document, repository)
    await expect(importDocument(document, repository)).rejects.toMatchObject({ code: 'duplicate-document' })
  })
})
