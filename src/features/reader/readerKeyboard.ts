const readerKeyboardExcludedSelector = 'input, textarea, select, button, a, [contenteditable="true"], .reader-panel, .textLayer, .pdf-text-layer, .reader-word, .reader-sentence-target'

function elementFromEventTarget(target: EventTarget | null): Element | undefined {
  return target instanceof Element ? target : undefined
}

export function hasNonEmptyTextSelection(selectedText = typeof window === 'undefined' ? '' : window.getSelection()?.toString() ?? '') {
  return selectedText.trim().length > 0
}

export function isReaderKeyboardEventBlocked(event: KeyboardEvent) {
  return event.defaultPrevented || event.isComposing || hasNonEmptyTextSelection() || Boolean(elementFromEventTarget(event.target)?.closest(readerKeyboardExcludedSelector))
}

export function getReaderSectionNavigationDelta(event: KeyboardEvent): -1 | 1 | undefined {
  if (event.repeat || isReaderKeyboardEventBlocked(event)) return undefined

  if ((event.key === 'ArrowLeft' || event.key === 'ArrowRight') && !event.ctrlKey && !event.altKey && !event.metaKey && !event.shiftKey) {
    return event.key === 'ArrowLeft' ? -1 : 1
  }

  if ((event.key === 'PageUp' || event.key === 'PageDown') && event.ctrlKey && !event.altKey && !event.metaKey && !event.shiftKey) {
    return event.key === 'PageUp' ? -1 : 1
  }

  return undefined
}

export type ReaderNavigationAction = 'previous-page' | 'next-page' | 'previous-section' | 'next-section'

export function getReaderNavigationAction(event: KeyboardEvent, mode: 'scroll' | 'pages', sectionIndex: number, sectionCount: number): ReaderNavigationAction | undefined {
  if (event.repeat || isReaderKeyboardEventBlocked(event)) return undefined
  const ctrlOnly = event.ctrlKey && !event.altKey && !event.metaKey && !event.shiftKey
  const plain = !event.ctrlKey && !event.altKey && !event.metaKey && !event.shiftKey
  const delta = event.key === 'ArrowLeft' || event.key === 'PageUp' ? -1 : event.key === 'ArrowRight' || event.key === 'PageDown' ? 1 : undefined
  if (ctrlOnly && (event.key === 'PageUp' || event.key === 'PageDown')) {
    const target = sectionIndex + (delta ?? 0)
    return target < 0 || target >= sectionCount ? undefined : delta === -1 ? 'previous-section' : 'next-section'
  }
  if (!plain || delta === undefined) return undefined
  if (mode === 'pages' && (event.key === 'PageUp' || event.key === 'PageDown' || event.key === 'ArrowLeft' || event.key === 'ArrowRight')) return delta < 0 ? 'previous-page' : 'next-page'
  if (mode === 'scroll' && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
    const target = sectionIndex + delta
    return target < 0 || target >= sectionCount ? undefined : delta < 0 ? 'previous-section' : 'next-section'
  }
  return undefined
}

export function isReaderEscapeBlocked(event: KeyboardEvent) {
  if (event.defaultPrevented || event.isComposing) return true
  return Boolean(elementFromEventTarget(event.target)?.closest('input, textarea, select, [contenteditable="true"]'))
}

export function shouldToggleReaderChrome({ target, currentTarget, defaultPrevented = false, selectedText = '' }: { target: EventTarget | null; currentTarget: EventTarget | null; defaultPrevented?: boolean; selectedText?: string }) {
  if (defaultPrevented || hasNonEmptyTextSelection(selectedText)) return false
  const element = elementFromEventTarget(target)
  if (!element) return target === currentTarget
  return !element.closest(readerKeyboardExcludedSelector)
}
