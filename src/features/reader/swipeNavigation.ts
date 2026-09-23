export type SwipePoint = { x: number; y: number; pointerCount?: number; startedAtEdge?: boolean; blockedTarget?: boolean }

/** True only for a deliberate, single-finger horizontal gesture from the reading surface. */
export function isReaderSwipe(start: SwipePoint, end: SwipePoint, selectedText = '') {
  if (start.pointerCount !== undefined && start.pointerCount !== 1) return false
  if (start.startedAtEdge || start.blockedTarget || selectedText.trim()) return false
  const dx = end.x - start.x
  const dy = end.y - start.y
  return Math.abs(dx) >= 56 && Math.abs(dx) > Math.abs(dy) * 1.35
}

export function isSwipeBlockedTarget(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest('a, button, input, textarea, select, [contenteditable="true"], .reader-panel, .reader-bottom-sheet, .reader-footnote, .pdf-text-layer, .textLayer, .annotation-editor, .selection-toolbar'))
}

export function readerSwipeBehavior(format: 'epub' | 'txt' | 'docx' | 'pdf', mode: 'pages' | 'scroll' | 'original' | 'reading', sectionCount: number): 'page' | 'section' | 'none' {
  if (format === 'pdf') return mode === 'original' ? 'page' : 'none'
  if (mode === 'pages' && format === 'epub') return 'page'
  return sectionCount > 1 ? 'section' : 'none'
}
