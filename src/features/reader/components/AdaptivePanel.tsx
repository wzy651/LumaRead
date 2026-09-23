import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react'
import { X } from 'lucide-react'

interface AdaptivePanelProps {
  anchorElement: HTMLElement
  children: ReactNode
  isMobile: boolean
  label: string
  onClose: () => void
  variant: 'bookmarks' | 'dictionary' | 'sentence' | 'settings' | 'more' | 'toc' | 'search' | 'footnote'
}

interface PanelPosition {
  left: number
  top: number
  width: number
}

const viewportMargin = 16
const anchorGap = 12

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [contenteditable="true"], [tabindex]:not([tabindex="-1"])'))
}

export function AdaptivePanel({ anchorElement, children, isMobile, label, onClose, variant }: AdaptivePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const previousOverflowRef = useRef('')
  const [position, setPosition] = useState<PanelPosition>({ left: viewportMargin, top: viewportMargin, width: 380 })

  const updatePosition = useCallback(() => {
    if (isMobile) return

    const anchorRect = anchorElement.getBoundingClientRect()
    const panelHeight = panelRef.current?.offsetHeight ?? 420
    const width = Math.min(400, window.innerWidth - viewportMargin * 2)
    const maximumLeft = Math.max(viewportMargin, window.innerWidth - width - viewportMargin)
    const left = Math.min(Math.max(anchorRect.left + anchorRect.width / 2 - width / 2, viewportMargin), maximumLeft)
    const roomBelow = window.innerHeight - anchorRect.bottom - anchorGap - viewportMargin
    const roomAbove = anchorRect.top - anchorGap - viewportMargin
    let top = anchorRect.bottom + anchorGap

    if (roomBelow < panelHeight && roomAbove > roomBelow) {
      top = Math.max(viewportMargin, anchorRect.top - panelHeight - anchorGap)
    } else {
      top = Math.min(top, Math.max(viewportMargin, window.innerHeight - panelHeight - viewportMargin))
    }

    setPosition({ left, top, width })
  }, [anchorElement, isMobile])

  useLayoutEffect(() => {
    updatePosition()
    if (isMobile || !panelRef.current) return

    const observer = new ResizeObserver(updatePosition)
    observer.observe(panelRef.current)
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [isMobile, updatePosition])

  useEffect(() => {
    const panel = panelRef.current
    const focusTimer = window.setTimeout(() => {
      if (!panel) return
      const preferredTarget = panel.querySelector<HTMLElement>('[data-autofocus="true"]')
      ;(preferredTarget ?? getFocusableElements(panel)[0])?.focus()
    }, 0)

    if (isMobile) {
      previousOverflowRef.current = document.body.style.overflow
      document.body.style.overflow = 'hidden'
    }

    return () => {
      window.clearTimeout(focusTimer)
      if (isMobile) document.body.style.overflow = previousOverflowRef.current
      if (document.contains(anchorElement)) anchorElement.focus({ preventScroll: true })
    }
  }, [anchorElement, isMobile])

  useEffect(() => {
    if (isMobile) return

    function handleOutsidePointerDown(event: PointerEvent) {
      const target = event.target
      if (!(target instanceof Node)) return
      if (panelRef.current?.contains(target) || anchorElement.contains(target)) return
      onClose()
    }

    document.addEventListener('pointerdown', handleOutsidePointerDown, true)
    return () => document.removeEventListener('pointerdown', handleOutsidePointerDown, true)
  }, [anchorElement, isMobile, onClose])

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!isMobile || event.key !== 'Tab' || !panelRef.current) return
    const focusable = getFocusableElements(panelRef.current)
    if (focusable.length === 0) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  const panelStyle = isMobile ? undefined : ({ left: position.left, top: position.top, width: position.width } satisfies CSSProperties)

  return (
    <div
      className={`reader-panel-backdrop ${isMobile ? 'reader-panel-backdrop--mobile' : 'reader-panel-backdrop--desktop'}`}
      onMouseDown={(event) => {
        if (isMobile && event.target === event.currentTarget) onClose()
      }}
    >
      <div
        aria-label={label}
        aria-modal={isMobile ? 'true' : undefined}
        className={`reader-panel reader-panel--${isMobile ? 'sheet' : 'popover'} reader-panel--${variant}`}
        onKeyDown={handleKeyDown}
        ref={panelRef}
        role="dialog"
        style={panelStyle}
      >
        {isMobile && <div aria-hidden="true" className="reader-panel__handle" />}
        <div className="reader-panel__topbar">
          <span>{label}</span>
          <button aria-label="关闭" className="reader-panel__close" data-autofocus="true" lang="zh-CN" onClick={onClose} type="button">
            <X aria-hidden="true" size={18} />
          </button>
        </div>
        <div className="reader-panel__content">{children}</div>
      </div>
    </div>
  )
}
