export function pageCountFromMetrics(scrollWidth: number, clientWidth: number, stride = clientWidth, inlinePadding = 0, columnGap = 0) {
  if (!Number.isFinite(scrollWidth) || !Number.isFinite(clientWidth) || clientWidth <= 0) return 1
  if (scrollWidth <= clientWidth + 1) return 1
  if (stride <= 0 || !Number.isFinite(stride)) return 1
  if (stride !== clientWidth || inlinePadding > 0 || columnGap > 0) return Math.max(1, Math.ceil(Math.max(0, scrollWidth - inlinePadding) / stride))
  return Math.max(1, Math.ceil(scrollWidth / clientWidth))
}

export function pageColumnWidth(clientWidth: number) {
  if (!Number.isFinite(clientWidth)) return 1
  return Math.max(1, clientWidth)
}

export function pageIndexFromScroll(scrollLeft: number, stride: number, pageCount: number) {
  if (stride <= 0) return 0
  return Math.min(Math.max(0, Math.round(scrollLeft / stride)), Math.max(0, pageCount - 1))
}

export function pageIndexFromProgress(progressPercent: number, pageCount: number) {
  if (!Number.isFinite(progressPercent) || pageCount <= 1) return 0
  const progress = Math.min(100, Math.max(0, progressPercent))
  return Math.round(progress / 100 * (pageCount - 1))
}

export function pageTurnTarget(pageIndex: number, pageCount: number, sectionIndex: number, sectionCount: number, delta: -1 | 1) {
  const nextPage = pageIndex + delta
  if (nextPage >= 0 && nextPage < pageCount) return { pageIndex: nextPage, sectionIndex, boundary: undefined }
  const nextSection = sectionIndex + delta
  if (nextSection < 0 || nextSection >= sectionCount) return { pageIndex, sectionIndex, boundary: undefined }
  return { pageIndex: delta < 0 ? -1 : 0, sectionIndex: nextSection, boundary: delta < 0 ? 'last' as const : 'first' as const }
}
