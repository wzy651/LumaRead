import { existsSync, readFileSync } from 'node:fs'
import { beforeAll, describe, expect, it } from 'vitest'

const fixtureRoot = process.env.LUMAREAD_QA_ARTIFACTS ?? 'D:\\Codex_product\\LumaRead-QA-Artifacts\\pdf-reader-95ff01e'
const textFixture = `${fixtureRoot}\\text-selectable-3-page.pdf`
const scanFixture = `${fixtureRoot}\\scanned-image-only-1-page.pdf`
const hasFixtures = existsSync(textFixture) && existsSync(scanFixture)

describe.runIf(hasFixtures)('PDF.js integration fixtures', () => {
  let pdfAdapter: typeof import('./pdf-adapter').pdfAdapter
  beforeAll(async () => {
    const bytePrototype = Uint8Array.prototype as Uint8Array & { toHex?: () => string }
    if (typeof bytePrototype.toHex !== 'function') Object.defineProperty(Uint8Array.prototype, 'toHex', { configurable: true, value(this: Uint8Array) { return Array.from(this, (value) => value.toString(16).padStart(2, '0')).join('') } })
    if (typeof globalThis.DOMMatrix === 'undefined') {
      Object.defineProperty(globalThis, 'DOMMatrix', { configurable: true, value: class {
        a = 1; b = 0; c = 0; d = 1; e = 0; f = 0; is2D = true
        constructor(values?: number[]) { if (values?.length === 6) [this.a, this.b, this.c, this.d, this.e, this.f] = values }
        invertSelf() { return this }
        multiplySelf() { return this }
        preMultiplySelf() { return this }
        translate() { return this }
        translateSelf() { return this }
        scale() { return this }
        scaleSelf() { return this }
      } })
    }
    pdfAdapter = (await import('./pdf-adapter')).pdfAdapter
  })

  it('extracts non-empty page sections and reflow capability from the selectable three-page PDF', async () => {
    const parsed = await pdfAdapter.parse({ blob: new Blob([readFileSync(textFixture)]), fileName: 'text-selectable-3-page.pdf', size: 0 })
    expect(parsed.sections).toHaveLength(3)
    expect(parsed.sections.every((section) => section.blocks.length > 0)).toBe(true)
    expect(parsed.capabilities).toMatchObject({ reflowable: true, supportsOriginalLayout: true, supportsTextSelection: true })
  })

  it('keeps the scanned image-only PDF in original layout without pretending OCR exists', async () => {
    const parsed = await pdfAdapter.parse({ blob: new Blob([readFileSync(scanFixture)]), fileName: 'scanned-image-only-1-page.pdf', size: 0 })
    expect(parsed.sections).toHaveLength(1)
    expect(parsed.sections[0].blocks).toEqual([])
    expect(parsed.capabilities).toMatchObject({ reflowable: false, supportsOriginalLayout: true, supportsTextSelection: false })
  })
})
