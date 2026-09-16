import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DocumentSource } from '../domain/documents'

const state = vi.hoisted(() => ({ getDocument: vi.fn(), destroy: vi.fn(), taskDestroy: vi.fn() }))
vi.mock('pdfjs-dist', () => ({ GlobalWorkerOptions: {}, getDocument: state.getDocument }))

import { paragraphsFromTextItems, pdfAdapter } from './pdf-adapter'

function minimalPdf() {
  const stream = 'BT\n/F1 12 Tf\n72 720 Td\n(Hello) Tj\nET\n'
  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>\nendobj\n',
    `4 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}endstream\nendobj\n`,
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
  ]
  const header = '%PDF-1.4\n'
  const offsets: number[] = []
  let body = header
  for (const object of objects) { offsets.push(body.length); body += object }
  const xref = body.length
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return body
}
function source(contents = minimalPdf(), fileName = 'book.pdf'): DocumentSource { const blob = new Blob([contents]); return { blob, fileName, size: blob.size } }
function item(str: string, x: number, y: number, options: Partial<{ width: number; height: number; hasEOL: boolean }> = {}) { return { str, transform: [1, 0, 0, 1, x, y], width: 20, height: 10, hasEOL: false, ...options } }
function configure(pages: unknown[][], metadata: { info: object; metadata: { get(name: string): unknown } | null } = { info: {}, metadata: null }) {
  const document = { numPages: pages.length, getMetadata: vi.fn().mockResolvedValue(metadata), getPage: vi.fn((page: number) => Promise.resolve({ getTextContent: vi.fn().mockResolvedValue({ items: pages[page - 1] }), cleanup: vi.fn() })), destroy: state.destroy }
  state.getDocument.mockReturnValue({ promise: Promise.resolve(document), destroy: state.taskDestroy })
  return document
}

beforeEach(() => vi.clearAllMocks())

describe('PDF adapter', () => {
  it('accepts a minimal valid local PDF header and emits stable page sections', async () => {
    configure([[item('Hello', 0, 100, { width: 25 }), item('world', 30, 100, { hasEOL: true })]])
    const parsed = await pdfAdapter.parse(source())
    expect(parsed.sections).toEqual([{ id: 'page-1', title: 'Page 1', order: 0, blocks: [{ id: 'page-1-paragraph-1', type: 'paragraph', text: 'Hello world', order: 0 }] }])
    expect(parsed.capabilities).toMatchObject({ reflowable: true, supportsTextSelection: true, supportsPagination: true, supportsSearch: false, supportsReadAloud: false, supportsTableOfContents: false })
    expect(state.getDocument).toHaveBeenCalledWith(expect.objectContaining({ data: expect.any(Uint8Array), disableAutoFetch: true, disableRange: true }))
    expect(state.destroy).toHaveBeenCalledOnce()
    expect(state.taskDestroy).not.toHaveBeenCalled()
  })
  it('keeps page order, permits empty pages, and falls back to the filename title', async () => {
    configure([[], [item('Second page', 0, 100, { hasEOL: true })]])
    const parsed = await pdfAdapter.parse(source('%PDF-1.4', 'notes.pdf'))
    expect(parsed.metadata).toMatchObject({ title: 'notes', language: 'und', sectionCount: 2 })
    expect(parsed.sections.map((section) => [section.id, section.blocks.length])).toEqual([['page-1', 0], ['page-2', 1]])
  })
  it('reads available title, author and language metadata', async () => {
    configure([[item('Text', 0, 100, { hasEOL: true })]], { info: { Title: 'Info title', Author: 'Ada', Language: 'en' }, metadata: { get: (name: string) => name === 'dc:title' ? 'Metadata title' : undefined } })
    await expect(pdfAdapter.parse(source())).resolves.toMatchObject({ metadata: { title: 'Metadata title', author: 'Ada', language: 'en' } })
  })
  it('reconstructs spaces and paragraphs without joining words', () => {
    expect(paragraphsFromTextItems([item('Hello', 0, 100, { width: 25 }), item('world', 30, 100, { hasEOL: true }), item('Next', 0, 85, { hasEOL: true }), item('Paragraph', 0, 50, { hasEOL: true })])).toEqual(['Hello world Next', 'Paragraph'])
  })
  it('rejects scanned PDFs with no readable text', async () => {
    configure([[]])
    await expect(pdfAdapter.parse(source())).rejects.toMatchObject({ code: 'parse-failed', message: expect.stringMatching(/no readable text/i) })
  })
  it('rejects malformed headers and maps damaged or password-protected PDFs to friendly errors', async () => {
    await expect(pdfAdapter.parse(source('not a pdf'))).rejects.toMatchObject({ code: 'invalid-document' })
    state.getDocument.mockReturnValue({ promise: Promise.reject(new Error('PasswordException: password required')), destroy: state.taskDestroy })
    await expect(pdfAdapter.parse(source())).rejects.toMatchObject({ code: 'read-failed', message: expect.stringMatching(/password-protected/i) })
    state.getDocument.mockReturnValue({ promise: Promise.reject(new Error('InvalidPDFException: malformed')), destroy: state.taskDestroy })
    await expect(pdfAdapter.parse(source())).rejects.toMatchObject({ code: 'invalid-document' })
  })
  it('never accepts a non-PDF source for selection', async () => { await expect(pdfAdapter.supports(source('hello', 'book.txt'))).resolves.toBe(false) })
})
