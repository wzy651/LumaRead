import { describe, expect, it } from 'vitest'
import { pdfScale, rotatedSize } from './pdfScale'
describe('PdfPage rendering calculations', () => {
  it('uses a rotation-zero base before rotating 90 degrees', () => expect(rotatedSize({ width: 600, height: 800 }, 90)).toEqual({ width: 800, height: 600 }))
  it('uses the final rotated width for Comfortable scale', () => expect(pdfScale('comfortable', { width: 976, height: 900 }, { width: 800, height: 600 })).toBe(1.18))
  it('keeps Actual size at 100 percent', () => expect(pdfScale('actual', { width: 100, height: 100 }, { width: 800, height: 600 }, 2)).toBe(1))
  it('uses fit-page height after rotation', () => expect(pdfScale('fit-page', { width: 900, height: 500 }, { width: 800, height: 600 })).toBeCloseTo(.633))
  it('bounds custom rendering scale', () => expect(pdfScale('custom', { width: 1, height: 1 }, { width: 1, height: 1 }, 9)).toBe(3))
})
