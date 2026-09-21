import { useEffect } from 'react'
import { isReaderEscapeBlocked } from './readerKeyboard'

export interface ReaderExitOptions {
  enabled?: boolean
  overlayOpen: boolean
  closeOverlay: () => void
  flushLocation: () => void | Promise<void>
  navigateHome: () => void
}

const flushTimeout = 300

async function flushLocationWithinBound(flushLocation: () => void | Promise<void>) {
  let timeoutId: number | undefined
  const flush = Promise.resolve().then(flushLocation).catch(() => undefined)
  const timeout = new Promise<void>((resolve) => {
    timeoutId = window.setTimeout(resolve, flushTimeout)
  })
  await Promise.race([flush, timeout])
  if (timeoutId !== undefined) window.clearTimeout(timeoutId)
}

export function useReaderExit({ enabled = true, overlayOpen, closeOverlay, flushLocation, navigateHome }: ReaderExitOptions) {
  useEffect(() => {
    if (!enabled) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape' || event.defaultPrevented || event.isComposing) return
      if (overlayOpen) {
        event.preventDefault()
        closeOverlay()
        return
      }
      if (isReaderEscapeBlocked(event)) return

      event.preventDefault()
      void flushLocationWithinBound(flushLocation).then(navigateHome).catch(() => navigateHome())
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [closeOverlay, enabled, flushLocation, navigateHome, overlayOpen])
}
