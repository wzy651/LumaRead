import { useEffect } from 'react'
import { getReaderSectionNavigationDelta } from './readerKeyboard'

interface ReaderKeyboardNavigationOptions {
  enabled?: boolean
  sectionCount: number
  sectionIndex: number
  onSectionChange: (nextIndex: number) => void
}

export function useReaderKeyboardNavigation({ enabled = true, sectionCount, sectionIndex, onSectionChange }: ReaderKeyboardNavigationOptions) {
  useEffect(() => {
    if (!enabled || sectionCount <= 1) return

    function handleKeyDown(event: KeyboardEvent) {
      const delta = getReaderSectionNavigationDelta(event)
      if (!delta) return
      const nextIndex = Math.min(Math.max(sectionIndex + delta, 0), sectionCount - 1)
      if (nextIndex === sectionIndex) return
      event.preventDefault()
      onSectionChange(nextIndex)
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [enabled, onSectionChange, sectionCount, sectionIndex])
}
