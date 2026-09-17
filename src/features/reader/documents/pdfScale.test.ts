import { describe, expect, it } from 'vitest'
import { clampCustomScale, clampPdfPage, pdfScale, rotatedSize } from './pdfScale'
describe('PDF scale', () => {
  it('bounds Comfortable at 960px and shrinks on narrow containers', () => { expect(pdfScale('comfortable', { width: 1800, height: 900 }, { width: 600, height: 800 })).toBe(1.6); expect(pdfScale('comfortable', { width: 400, height: 900 }, { width: 600, height: 800 })).toBeCloseTo(.613) })
  it('fits width, page and actual size independently', () => { expect(pdfScale('fit-width', { width: 632, height: 900 }, { width: 600, height: 800 })).toBe(1); expect(pdfScale('fit-page', { width: 1000, height: 520 }, { width: 600, height: 800 })).toBe(.5); expect(pdfScale('actual', { width: 1, height: 1 }, { width: 600, height: 800 }, 2.5)).toBe(1) })
  it('clamps custom zoom and uses rotated dimensions', () => { expect(clampCustomScale(10)).toBe(3); expect(clampCustomScale(.1)).toBe(.25); expect(rotatedSize({ width: 600, height: 800 }, 90)).toEqual({ width: 800, height: 600 }); expect(clampPdfPage(99, 3)).toBe(3) })
})
