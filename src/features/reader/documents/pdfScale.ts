export type PdfZoomMode = 'comfortable' | 'fit-width' | 'fit-page' | 'actual' | 'custom'
export type PdfSize = { width: number; height: number }
export function clampPdfPage(page: number, total: number) { return Math.min(Math.max(1, Math.round(page) || 1), Math.max(1, total)) }
export function rotatedSize(page: PdfSize, rotation: number): PdfSize { return rotation % 180 === 0 ? page : { width: page.height, height: page.width } }
export function clampCustomScale(value: number) { return Math.min(3, Math.max(.25, value)) }
const PDF_TO_CSS_UNITS = 96 / 72

export function pdfScale(mode: PdfZoomMode, available: PdfSize, page: PdfSize, custom = 1) {
  if (mode === 'actual') return PDF_TO_CSS_UNITS
  if (mode === 'custom') return clampCustomScale(custom)
  const availableWidth = Math.max(1, available.width)
  const availableHeight = Math.max(1, available.height)
  if (mode === 'comfortable') return Math.max(.1, Math.min(900, availableWidth) / page.width)
  if (mode === 'fit-width') return Math.max(.1, availableWidth / page.width)
  return Math.max(.1, Math.min(availableWidth / page.width, availableHeight / page.height))
}
