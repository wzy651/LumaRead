import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type Ref } from 'react'
import { AdaptivePanel } from '../reader/components/AdaptivePanel'
import { excerptAtPoint, excerptFromSelection, type ExcerptSource, type LocatedExcerpt } from './selection'
import { LookupContent } from './LookupContent'
import { LearningSettingsForm } from './LearningSettingsForm'
import './learning.css'

export interface ReadingHelpHandle { openSelection(): void; openText(text: string, anchor: HTMLElement): void; close(): void }
interface Props extends ExcerptSource {
  ref?: Ref<ReadingHelpHandle>
  isMobile: boolean
  otherPanelOpen: boolean
  onOpen: () => void
  onActiveChange: (value: boolean) => void
  standaloneSelection?: boolean
}
export function ReadingHelp({ ref, isMobile, otherPanelOpen, onOpen, onActiveChange, standaloneSelection, ...source }: Props) {
  const host = useRef<HTMLSpanElement>(null)
  const latest = useRef({ source, onOpen, onActiveChange })
  useLayoutEffect(() => { latest.current = { source, onOpen, onActiveChange } })
  const [located, setLocated] = useState<LocatedExcerpt>(); const [showSettings, setShowSettings] = useState(false)
  const [selection, setSelection] = useState<LocatedExcerpt>()
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const close = useCallback(() => { setLocated(undefined); setShowSettings(false); latest.current.onActiveChange(false) }, [])
  const open = useCallback((next: LocatedExcerpt) => { latest.current.onOpen(); setSelection(undefined); setShowSettings(false); setLocated(next); latest.current.onActiveChange(true) }, [])
  useImperativeHandle(ref, () => ({
    close,
    openSelection() { const root = host.current?.closest<HTMLElement>('.reader-shell'); if (!root) return; const next = excerptFromSelection(root, latest.current.source); if (next) open(next) },
    openText(text, anchor) {
      const block = anchor.closest<HTMLElement>('[data-reader-block-id], .reader-prose p')
      open({ anchor, rect: anchor.getBoundingClientRect(), excerpt: { ...latest.current.source, text: text.slice(0, 600), sentence: (block?.textContent ?? text).slice(0, 1600), blockId: block?.dataset.readerBlockId } })
    },
  }), [open, close])
  useEffect(() => {
    const root = host.current?.closest<HTMLElement>('.reader-shell')
    if (!root) return
    let down: { x: number; y: number } | undefined, dragged = false
    const start = (event: PointerEvent) => { clearTimeout(timer.current); down = { x: event.clientX, y: event.clientY }; dragged = false }
    const move = (event: PointerEvent) => { if (down && Math.hypot(event.clientX - down.x, event.clientY - down.y) > 8) dragged = true }
    const cancel = () => { dragged = true; down = undefined; clearTimeout(timer.current) }
    const click = (event: MouseEvent) => {
      clearTimeout(timer.current)
      if (event.defaultPrevented || event.button !== 0 || event.detail > 1 || dragged || window.getSelection()?.toString().trim()) return
      const next = excerptAtPoint(root, event, latest.current.source)
      if (!next) return
      event.stopPropagation()
      timer.current = setTimeout(() => { if (!window.getSelection()?.toString().trim()) open(next) }, 180)
    }
    const end = () => {
      if (!standaloneSelection) return
      requestAnimationFrame(() => { if (host.current) setSelection(excerptFromSelection(root, latest.current.source)) })
    }
    const key = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'l' && event.ctrlKey && event.shiftKey && !event.isComposing) { const next = excerptFromSelection(root, latest.current.source); if (next) { event.preventDefault(); event.stopImmediatePropagation(); open(next) } }
    }
    root.addEventListener('pointerdown', start, true); root.addEventListener('pointermove', move, true); root.addEventListener('pointercancel', cancel, true); root.addEventListener('click', click, true); root.addEventListener('pointerup', end)
    document.addEventListener('keydown', key, true)
    return () => { clearTimeout(timer.current); root.removeEventListener('pointerdown', start, true); root.removeEventListener('pointermove', move, true); root.removeEventListener('pointercancel', cancel, true); root.removeEventListener('click', click, true); root.removeEventListener('pointerup', end); document.removeEventListener('keydown', key, true); latest.current.onActiveChange(false) }
  }, [open, standaloneSelection])
  useEffect(() => {
    if (!located) return
    const escape = (event: KeyboardEvent) => { if (event.key !== 'Escape' || event.isComposing) return; event.preventDefault(); event.stopImmediatePropagation(); if (showSettings) setShowSettings(false); else close() }
    document.addEventListener('keydown', escape, true)
    return () => document.removeEventListener('keydown', escape, true)
  }, [located, showSettings, close])
  return <><span ref={host} hidden />
    {selection && !located && <div className="pdf-selection-help"><button type="button" onPointerDown={(event) => event.preventDefault()} onClick={() => open(selection)}>理解所选文字</button></div>}
    {located && !otherPanelOpen && <AdaptivePanel anchorElement={located.anchor} anchorRect={located.rect} isMobile={isMobile} label={showSettings ? '解释服务设置' : 'Quick meaning'} onClose={close} variant="dictionary">
      <div hidden={showSettings}><LookupContent key={`${located.excerpt.text}:${located.excerpt.sentence}`} excerpt={located.excerpt} onSettings={() => setShowSettings(true)} onClose={close} /></div>
      {showSettings && <><button className="lookup-text-button" type="button" onClick={() => setShowSettings(false)}>← 返回原句</button><LearningSettingsForm onSaved={() => setShowSettings(false)} /></>}
    </AdaptivePanel>}
  </>
}
