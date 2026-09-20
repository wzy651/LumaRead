export function shouldTogglePdfChrome(target: EventTarget | null, currentTarget: EventTarget | null, selectedText: string) {
  if (selectedText.trim()) return false
  if (!target || typeof (target as { closest?: unknown }).closest !== 'function') return target === currentTarget
  return !(target as HTMLElement).closest('button, a, input, select, textarea, .reader-panel, .textLayer')
}
