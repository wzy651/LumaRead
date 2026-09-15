import { describe, expect, it } from 'vitest'
import type { DocumentSource } from '../../domain/documents'
import { MemoryDocumentRepository } from '../../storage'
import { importDocument } from './import-document'

describe('document import', () => {
  it('decodes TXT once during the adapter parse flow', async () => {
    const bytes = new TextEncoder().encode('A quiet paragraph.')
    let textReads = 0
    const blob = { text: async () => { textReads += 1; return 'A quiet paragraph.' }, arrayBuffer: async () => bytes.buffer, slice: () => new Blob([bytes]) } as unknown as Blob
    const source: DocumentSource = { blob, fileName: 'quiet.txt', size: bytes.byteLength }
    await importDocument(source, new MemoryDocumentRepository())
    expect(textReads).toBe(1)
  })
})
