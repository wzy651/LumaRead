interface ReaderChromeRevealZoneProps {
  onReveal: () => void
  visible: boolean
}

export function ReaderChromeRevealZone({ onReveal, visible }: ReaderChromeRevealZoneProps) {
  if (visible) return null
  return <div aria-hidden="true" className="reader-chrome-reveal-zone" onClick={onReveal} onPointerEnter={onReveal} onPointerMove={onReveal} tabIndex={-1} />
}
