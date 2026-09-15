import { describe, expect, it } from 'vitest'
import { DocumentError, type DocumentSource, type ImportedDocument } from '../domain/documents'
import { txtAdapter } from './txt-adapter'

function source(text: string, fileName = 'quiet.txt'): DocumentSource { return { blob: new Blob([text]), fileName, size: new Blob([text]).size } }
const document: ImportedDocument = { id: 'doc', format: 'txt', fileName: 'quiet.txt', fileSize: 1, importedAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', metadata: { title: 'quiet' }, fingerprint: 'a', status: 'ready' }
describe('TXT adapter', () => {
  it('removes UTF-8 BOM and normalizes all newlines into paragraphs', async () => { const opened = await txtAdapter.open(source('\uFEFFFirst\r\nline\r\n\rSecond\n\nThird'), document); expect(opened.sections[0].content).toEqual(['First line', 'Second', 'Third']) })
  it('uses the file name for metadata', async () => { await expect(txtAdapter.parseMetadata(source('Words', 'A Quiet Book.txt'))).resolves.toMatchObject({ title: 'A Quiet Book', sectionCount: 1 }) })
  it('rejects empty text', async () => { await expect(txtAdapter.open(source(' \n\r '), document)).rejects.toMatchObject({ code: 'empty-file' } satisfies Partial<DocumentError>) })
})
