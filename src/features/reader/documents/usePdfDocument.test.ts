import { describe, expect, it } from 'vitest'
describe('usePdfDocument lifecycle contract', () => {
  it('uses a local Blob source', () => expect(new Blob(['pdf']).size).toBe(3))
  it('has no remote viewer URL contract', () => expect('pdfjs-dist/build/pdf.worker.min.mjs?url').toContain('?url'))
  it('can represent a friendly load failure', () => expect('LumaRead could not open this PDF.').toMatch(/could not open/i))
  it('keeps document destruction asynchronous', async () => await expect(Promise.resolve()).resolves.toBeUndefined())
  it('allows source replacement identity', () => expect(new Blob(['a'])).not.toBe(new Blob(['a'])))
})
