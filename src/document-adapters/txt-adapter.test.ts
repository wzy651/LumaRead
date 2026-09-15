import { describe, expect, it } from 'vitest'
import type { DocumentSource } from '../domain/documents'
import { txtAdapter } from './txt-adapter'
function source(text: string, fileName = 'quiet.txt'): DocumentSource { const blob = new Blob([text]); return { blob, fileName, size: blob.size } }
describe('TXT adapter', () => {
  it('parses once into stable paragraph blocks while removing BOM and normalizing newlines', async () => { const parsed = await txtAdapter.parse(source('\uFEFFFirst\r\nline\r\n\rSecond\n\nThird')); expect(parsed.metadata).toMatchObject({ title: 'quiet', sectionCount: 1 }); expect(parsed.sections[0].blocks).toEqual([{ id: 'paragraph-0', type: 'paragraph', text: 'First line', order: 0 }, { id: 'paragraph-1', type: 'paragraph', text: 'Second', order: 1 }, { id: 'paragraph-2', type: 'paragraph', text: 'Third', order: 2 }]) })
  it('rejects empty text and replacement-character-heavy input', async () => { await expect(txtAdapter.parse(source(' \n\r '))).rejects.toMatchObject({ code: 'empty-file' }); await expect(txtAdapter.parse(source('������'))).rejects.toMatchObject({ code: 'invalid-document' }) })
})
