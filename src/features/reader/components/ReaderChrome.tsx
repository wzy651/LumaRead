import { ArrowLeft, List, MoreHorizontal, Scaling } from 'lucide-react'
import type { RefObject } from 'react'

interface ReaderChromeProps {
  chromeRef: RefObject<HTMLElement | null>
  bookTitle: string
  chapterLabel: string
  isMobile: boolean
  onBack: () => void
  onMore: (target: HTMLButtonElement) => void
  onSettings: (target: HTMLButtonElement) => void
  visible: boolean
  pdf?: boolean
}

export function ReaderChrome({ bookTitle, chapterLabel, chromeRef, isMobile, onBack, onMore, onSettings, visible, pdf = false }: ReaderChromeProps) {
  return (
    <header aria-hidden={!visible} aria-label="Reader controls" className={`reader-topbar reader-chrome--${visible ? 'visible' : 'hidden'}`} inert={!visible} ref={chromeRef}>
      <button aria-label="Back to previous page" className="reader-chrome__button" onClick={onBack} type="button"><ArrowLeft aria-hidden="true" size={19} /></button>
      <div className="reader-book-identity"><span>{bookTitle}</span><small>{chapterLabel}</small></div>
      {!isMobile && <div className="reader-topbar__progress">{chapterLabel}</div>}
      <div className="reader-chrome__actions">
        {!isMobile && !pdf && <button aria-label="Table of contents (coming soon)" className="reader-chrome__button" disabled type="button"><List aria-hidden="true" size={19} /></button>}
        <button aria-label={pdf ? 'PDF view settings' : 'Reading settings'} className="reader-chrome__button reader-chrome__settings" onClick={(event) => onSettings(event.currentTarget)} type="button">{pdf ? <Scaling aria-hidden="true" size={19} /> : <span aria-hidden="true">Aa</span>}</button>
        <button aria-label="More reader options" className="reader-chrome__button" onClick={(event) => onMore(event.currentTarget)} type="button"><MoreHorizontal aria-hidden="true" size={20} /></button>
      </div>
    </header>
  )
}
