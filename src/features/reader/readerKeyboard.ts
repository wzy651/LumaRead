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
