import { describe, expect, it } from 'vitest'
import { clampCustomScale, clampPdfPage, pdfScale, rotatedSize } from './pdfScale'
describe('PDF scale', () => {
  it('targets a comfortable 900px page without exceeding stage content width', () => { expect(pdfScale('comfortable', { width: 1800, height: 900 }, { width: 600, height: 800 })).toBe(1.5); expect(pdfScale('comfortable', { width: 400, height: 900 }, { width: 600, height: 800 })).toBeCloseTo(2 / 3) })
  it('fits width and page using the measured stage content box', () => { expect(pdfScale('fit-width', { width: 632, height: 900 }, { width: 600, height: 800 })).toBeCloseTo(632 / 600); expect(pdfScale('fit-page', { width: 1000, height: 520 }, { width: 600, height: 800 })).toBe(.65); expect(pdfScale('actual', { width: 1, height: 1 }, { width: 600, height: 800 }, 2.5)).toBeCloseTo(96 / 72) })
  it('clamps custom zoom and uses rotated dimensions', () => { expect(clampCustomScale(10)).toBe(3); expect(clampCustomScale(.1)).toBe(.25); expect(rotatedSize({ width: 600, height: 800 }, 90)).toEqual({ width: 800, height: 600 }); expect(clampPdfPage(99, 3)).toBe(3) })
})
