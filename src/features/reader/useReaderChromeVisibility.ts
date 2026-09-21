import { useCallback, useEffect, useRef, useState } from 'react'

const idleDelay = 4000
const desktopRevealRange = 104

export function useReaderChromeVisibility({ isMobile, overlayOpen }: { isMobile: boolean; overlayOpen: boolean }) {
  const [visible, setVisible] = useState(true)
  const timerRef = useRef<number | undefined>(undefined)
  const chromeRef = useRef<HTMLElement>(null)
  const visibleRef = useRef(visible)
  const overlayOpenRef = useRef(overlayOpen)
  const pointerInsideChromeRef = useRef(false)
  const scheduleHideRef = useRef<() => void>(() => undefined)

  const clearTimer = useCallback(() => {
    if (timerRef.current !== undefined) {
      window.clearTimeout(timerRef.current)
      timerRef.current = undefined
    }
  }, [])

  const scheduleHide = useCallback(() => {
    clearTimer()
    timerRef.current = window.setTimeout(() => {
      if (!visibleRef.current || overlayOpenRef.current) return
      const active = document.activeElement
      const focusInsideChrome = active instanceof HTMLElement && chromeRef.current?.contains(active)
      const selectedText = window.getSelection()?.toString().trim()
      if (focusInsideChrome || pointerInsideChromeRef.current || selectedText) {
        scheduleHideRef.current()
        return
      }
      setVisible(false)
    }, idleDelay)
  }, [clearTimer])

  useEffect(() => {
    visibleRef.current = visible
    overlayOpenRef.current = overlayOpen
    scheduleHideRef.current = scheduleHide
  }, [overlayOpen, scheduleHide, visible])

  const hide = useCallback(() => {
    clearTimer()
    if (!overlayOpenRef.current) setVisible(false)
  }, [clearTimer])

  const reveal = useCallback(() => {
    clearTimer()
    setVisible(true)
    if (!overlayOpenRef.current) scheduleHide()
  }, [clearTimer, scheduleHide])

  useEffect(() => {
    clearTimer()
    if (visible && !overlayOpen) scheduleHide()
    return clearTimer
  }, [clearTimer, overlayOpen, scheduleHide, visible])

  useEffect(() => {
    const chrome = chromeRef.current
    if (!chrome) return

    const onPointerEnter = () => {
      pointerInsideChromeRef.current = true
      clearTimer()
    }
    const onPointerLeave = () => {
      pointerInsideChromeRef.current = false
      if (visibleRef.current && !overlayOpenRef.current) scheduleHide()
    }
    chrome.addEventListener('pointerenter', onPointerEnter)
    chrome.addEventListener('pointerleave', onPointerLeave)
    return () => {
      chrome.removeEventListener('pointerenter', onPointerEnter)
      chrome.removeEventListener('pointerleave', onPointerLeave)
    }
  }, [clearTimer, scheduleHide, visible])

  useEffect(() => {
    function onPointerMove(event: PointerEvent) {
      if (!isMobile && !visibleRef.current && event.clientY <= desktopRevealRange) reveal()
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Tab' && !event.defaultPrevented && !event.isComposing && !visibleRef.current && !overlayOpenRef.current) {
        event.preventDefault()
        reveal()
        window.requestAnimationFrame(() => {
          chromeRef.current?.querySelector<HTMLButtonElement>('button:not([disabled])')?.focus({ preventScroll: true })
        })
      }
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
  }, [hide, isMobile, reveal])

  return { chromeRef, hide, reveal, visible }
}
