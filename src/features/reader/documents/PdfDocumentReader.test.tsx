import { describe, expect, it } from 'vitest'
import { shouldTogglePdfChrome } from './pdfChrome'
describe('PdfDocumentReader chrome interaction', () => {
  const target = (matches: boolean) => ({ closest: () => matches ? {} : null }) as unknown as EventTarget
  it('allows stage background clicks', () => { const stage = target(false); expect(shouldTogglePdfChrome(stage, stage, '')).toBe(true) })
  it('does not toggle with selected text', () => { const stage = target(false); expect(shouldTogglePdfChrome(stage, stage, 'selected')).toBe(false) })
  it('does not toggle button clicks', () => expect(shouldTogglePdfChrome(target(true), target(false), '')).toBe(false))
  it('does not toggle text-layer clicks', () => expect(shouldTogglePdfChrome(target(true), target(false), '')).toBe(false))
  it('does not toggle panel clicks', () => expect(shouldTogglePdfChrome(target(true), target(false), '')).toBe(false))
})
