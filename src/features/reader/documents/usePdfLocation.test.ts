import { describe, expect, it } from 'vitest'
import type { PdfLocationState } from './usePdfLocation'
describe('usePdfLocation state shape', () => {
  const state: PdfLocationState = { page: 3, mode: 'reading', zoomMode: 'custom', zoom: 1.25, rotation: 90 }
  it('retains page', () => expect(state.page).toBe(3))
  it('retains reading mode', () => expect(state.mode).toBe('reading'))
  it('retains zoom mode and custom zoom', () => expect(state).toMatchObject({ zoomMode: 'custom', zoom: 1.25 }))
  it('retains rotation', () => expect(state.rotation).toBe(90))
  it('uses a page location label contract', () => expect(`Page ${state.page} of 8`).toBe('Page 3 of 8'))
})
