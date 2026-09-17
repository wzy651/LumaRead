export type PdfZoomMode = 'comfortable' | 'fit-width' | 'fit-page' | 'actual' | 'custom'
export type PdfSize = { width: number; height: number }
export function clampPdfPage(page: number, total: number) { return Math.min(Math.max(1, Math.round(page) || 1), Math.max(1, total)) }
export function rotatedSize(page: PdfSize, rotation: number): PdfSize { return rotation % 180 === 0 ? page : { width: page.height, height: page.width } }
export function clampCustomScale(value: number) { return Math.min(3, Math.max(.25, value)) }
export function pdfScale(mode: PdfZoomMode, available: PdfSize, page: PdfSize, custom = 1) { if (mode === 'actual') return 1; if (mode === 'custom') return clampCustomScale(custom); const safeWidth = Math.max(1, available.width - 32); if (mode === 'comfortable') return Math.max(.2, Math.min(safeWidth, 960) / page.width); if (mode === 'fit-width') return Math.max(.2, safeWidth / page.width); return Math.max(.2, Math.min(safeWidth / page.width, Math.max(1, available.height - 120) / page.height)) }
