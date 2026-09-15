import { useCallback, useEffect, useRef, useState } from 'react'

const idleDelay = 3200

export function useReaderChromeVisibility({ isMobile, overlayOpen }: { isMobile: boolean; overlayOpen: boolean }) {
  const [visible, setVisible] = useState(true)
  const timerRef = useRef<number | undefined>(undefined)
  const chromeRef = useRef<HTMLElement>(null)

  const clearTimer = useCallback(() => {
    if (timerRef.current !== undefined) window.clearTimeout(timerRef.current)
  }, [])

  const hide = useCallback(() => {
    clearTimer()
    if (!overlayOpen) setVisible(false)
  }, [clearTimer, overlayOpen])

  const reveal = useCallback(() => {
    clearTimer()
    setVisible(true)
  }, [clearTimer])

  useEffect(() => {
    clearTimer()
    if (!visible || overlayOpen) return
    timerRef.current = window.setTimeout(() => {
      const active = document.activeElement
      if (active instanceof HTMLElement && chromeRef.current?.contains(active)) return
      setVisible(false)
    }, idleDelay)
    return clearTimer
  }, [clearTimer, overlayOpen, visible])

  useEffect(() => {
    function onPointerMove(event: PointerEvent) {
      if (!isMobile && event.clientY <= 72) reveal()
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Tab' && !visible && !overlayOpen) {
        event.preventDefault()
        reveal()
        window.requestAnimationFrame(() => {
          chromeRef.current?.querySelector<HTMLButtonElement>('button:not([disabled])')?.focus()
        })
      }
      if (event.key === 'Escape' && !overlayOpen && visible) hide()
    }
    function onScroll() {
      hide()
    }
    document.addEventListener('pointermove', onPointerMove, { passive: true })
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('scroll', onScroll, { capture: true, passive: true })
    return () => {
      document.removeEventListener('pointermove', onPointerMove)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [clearTimer, hide, isMobile, overlayOpen, reveal, visible])

  return { chromeRef, hide, reveal, visible }
}
