import { describe, expect, it, vi } from 'vitest'
import { adapterFor } from './index'

vi.mock('pdfjs-dist', () => ({ GlobalWorkerOptions: {}, getDocument: vi.fn() }))
vi.mock('pdfjs-dist/build/pdf.worker.min.mjs?url', () => ({ default: 'pdf-worker.js' }))

describe('adapterFor', () => {
  it.each(['txt', 'epub', 'pdf', 'docx'] as const)('loads the %s adapter on demand', async (format) => {
    expect((await adapterFor(format)).format).toBe(format)
  })
})
