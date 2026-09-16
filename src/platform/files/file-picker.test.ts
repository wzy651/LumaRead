import { describe, expect, it } from 'vitest'
import type { DocumentSource } from '../../domain/documents'
import { fileSizeLimits, formatFromName, validateFileSignature } from './file-picker'
const source = (value: string): DocumentSource => ({ blob: new Blob([value]), fileName: 'sample.pdf', size: value.length })
describe('document file recognition', () => {
  it('recognizes extensions without trusting MIME types', () => { expect(formatFromName('A.TXT')).toBe('txt'); expect(formatFromName('book.mobi')).toBeUndefined() })
  it('checks a PDF header', async () => { await expect(validateFileSignature(source('%PDF-1.7'), 'pdf')).resolves.toBeUndefined(); await expect(validateFileSignature(source('not pdf'), 'pdf')).rejects.toMatchObject({ code: 'invalid-document' }) })
  it('checks ZIP containers for EPUB and DOCX', async () => { await expect(validateFileSignature(source('PK\x03\x04'), 'epub')).resolves.toBeUndefined(); await expect(validateFileSignature(source('PK\x03\x04'), 'docx')).resolves.toBeUndefined(); await expect(validateFileSignature(source('no zip'), 'epub')).rejects.toMatchObject({ code: 'invalid-document' }) })
  it('centralizes size limits', () => { expect(fileSizeLimits.txt).toBe(10 * 1024 * 1024) })
})

describe('local document picker', () => {
  it('rejects TXT files over the configured limit', async () => {
    const { sourceFromFile } = await import('./file-picker')
    expect(() => sourceFromFile({ name: 'large.txt', size: fileSizeLimits.txt + 1 } as File)).toThrow(expect.objectContaining({ code: 'file-too-large' }))
  })

  it('settles on cancel and ignores a later change event', async () => {
    const { chooseLocalDocument } = await import('./file-picker')
    const savedWindow = globalThis.window
    const listeners = new Map<string, EventListener>()
    let removed = 0
    const input = { style: {}, addEventListener: (type: string, listener: EventListener) => listeners.set(type, listener), remove: () => { removed += 1 }, click: () => undefined, files: [{ name: 'later.txt', size: 5 }] } as unknown as HTMLInputElement
    Object.assign(globalThis, { window: { document: { createElement: () => input, body: { append: () => undefined } } } })
    try {
      const chosen = chooseLocalDocument()
      listeners.get('cancel')?.(new Event('cancel'))
      listeners.get('change')?.(new Event('change'))
      await expect(chosen).resolves.toBeUndefined()
      expect(removed).toBe(1)
    } finally {
      Object.assign(globalThis, { window: savedWindow })
    }
  })
})
