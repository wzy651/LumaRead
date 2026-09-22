import { useEffect } from 'react'

interface Options {
  enabled?: boolean
  open: () => void
  focus: () => void
  openAlready: boolean
}

export function useReaderSearchShortcut({ enabled = true, open, focus, openAlready }: Options) {
  useEffect(() => {
    if (!enabled) return
    function handleKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.isComposing || event.altKey || event.shiftKey || (!event.ctrlKey && !event.metaKey) || event.key.toLowerCase() !== 'f') return
      event.preventDefault()
      if (openAlready) focus()
      else open()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [enabled, focus, open, openAlready])
}
