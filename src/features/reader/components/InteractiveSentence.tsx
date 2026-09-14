import { useEffect, useRef, type KeyboardEvent, type PointerEvent } from 'react'

interface InteractiveSentenceProps {
  children: string
  onOpen: (anchor: HTMLElement) => void
}

export function InteractiveSentence({ children, onOpen }: InteractiveSentenceProps) {
  const sentenceRef = useRef<HTMLSpanElement>(null)
  const longPressTimerRef = useRef<number | undefined>(undefined)
  const pressStartRef = useRef<{ pointerId: number; x: number; y: number } | null>(null)
  const longPressReadyRef = useRef(false)

  function clearLongPress() {
    if (longPressTimerRef.current !== undefined) {
      window.clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = undefined
    }
    pressStartRef.current = null
    longPressReadyRef.current = false
  }

  useEffect(() => clearLongPress, [])

  function handlePointerDown(event: PointerEvent<HTMLSpanElement>) {
    if (event.pointerType !== 'touch') return
    clearLongPress()
    pressStartRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY }
    event.currentTarget.setPointerCapture(event.pointerId)
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTimerRef.current = undefined
      longPressReadyRef.current = true
    }, 520)
  }

  function handlePointerMove(event: PointerEvent<HTMLSpanElement>) {
    const start = pressStartRef.current
    if (!start || start.pointerId !== event.pointerId) return
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10) clearLongPress()
  }

  function handlePointerEnd(event: PointerEvent<HTMLSpanElement>) {
    const shouldOpen = longPressReadyRef.current
    const anchor = sentenceRef.current
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    clearLongPress()
    if (shouldOpen && anchor) {
      event.preventDefault()
      window.requestAnimationFrame(() => onOpen(anchor))
    }
  }

  function handlePointerCancel(event: PointerEvent<HTMLSpanElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    clearLongPress()
  }

  function handleSelection() {
    const selection = window.getSelection()
    const sentence = sentenceRef.current
    if (!sentence || !selection || selection.isCollapsed || selection.toString().trim().length < 4) return
    const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null
    if (range && sentence.contains(range.commonAncestorContainer)) onOpen(sentence)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLSpanElement>) {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    if (sentenceRef.current) onOpen(sentenceRef.current)
  }

  return (
    <span
      aria-label={`${children}。选中或长按以查看句子解释`}
      className="reader-sentence-target"
      onKeyDown={handleKeyDown}
      onMouseUp={handleSelection}
      onPointerCancel={handlePointerCancel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      ref={sentenceRef}
      role="button"
      tabIndex={0}
    >
      {children}
    </span>
  )
}
