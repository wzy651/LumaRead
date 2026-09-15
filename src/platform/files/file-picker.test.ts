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
