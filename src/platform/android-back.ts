/** Reuses existing overlay/Escape priority so native Back cannot discard a note. */
export function handleAndroidBack(pathname: string, navigateHome: () => void, exitApp: () => void) {
  const target = document.activeElement ?? document.body
  const event = new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true })
  target.dispatchEvent(event)
  if (event.defaultPrevented) return
  if (target instanceof HTMLElement && target.matches('input, textarea, [contenteditable="true"]')) { target.blur(); return }
  if (pathname === '/') exitApp()
  else navigateHome()
}
