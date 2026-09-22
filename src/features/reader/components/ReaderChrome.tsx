import { ArrowLeft, Bookmark, BookmarkCheck, List, MoreHorizontal, Scaling, Search } from 'lucide-react'
import type { RefObject } from 'react'

interface ReaderChromeProps {
  chromeRef: RefObject<HTMLElement | null>
  bookTitle: string
  chapterLabel: string
  isMobile: boolean
  onBack: () => void
  onMore: (target: HTMLButtonElement) => void
  onSettings: (target: HTMLButtonElement) => void
  onToggleBookmark: () => void
  onOpenBookmarks: (target: HTMLButtonElement) => void
  onOpenSearch: (target: HTMLButtonElement) => void
  backLabel?: string
  bookmarkActive: boolean
  visible: boolean
  pdf?: boolean
}

export function ReaderChrome({ bookTitle, chapterLabel, chromeRef, isMobile, onBack, onMore, onSettings, onToggleBookmark, onOpenBookmarks, onOpenSearch, backLabel = 'Back to previous page', bookmarkActive, visible, pdf = false }: ReaderChromeProps) {
  return (
    <header aria-hidden={!visible} aria-label="Reader controls" className={`reader-topbar reader-chrome--${visible ? 'visible' : 'hidden'}`} inert={!visible} ref={chromeRef}>
      <button aria-label={backLabel} className="reader-chrome__button" onClick={onBack} type="button"><ArrowLeft aria-hidden="true" size={19} /></button>
      <div className="reader-book-identity"><span>{bookTitle}</span><small>{chapterLabel}</small></div>
      {!isMobile && <div className="reader-topbar__progress">{chapterLabel}</div>}
      <div className="reader-chrome__actions">
        {!isMobile && !pdf && <button aria-label="Table of contents (coming soon)" className="reader-chrome__button" disabled type="button"><List aria-hidden="true" size={19} /></button>}
        <button aria-label={bookmarkActive ? 'Remove bookmark' : 'Add bookmark'} aria-pressed={bookmarkActive} className={`reader-chrome__button reader-chrome__bookmark ${bookmarkActive ? 'is-active' : ''}`} onClick={onToggleBookmark} type="button">{bookmarkActive ? <BookmarkCheck aria-hidden="true" size={19} /> : <Bookmark aria-hidden="true" size={19} />}</button>
        <button aria-label="Open bookmarks" className="reader-chrome__button" onClick={(event) => onOpenBookmarks(event.currentTarget)} type="button"><BookmarkCheck aria-hidden="true" size={19} /></button>
        <button aria-label="Search in current book" className="reader-chrome__button" onClick={(event) => onOpenSearch(event.currentTarget)} type="button"><Search aria-hidden="true" size={19} /></button>
        <button aria-label={pdf ? 'PDF view settings' : 'Reading settings'} className="reader-chrome__button reader-chrome__settings" onClick={(event) => onSettings(event.currentTarget)} type="button">{pdf ? <Scaling aria-hidden="true" size={19} /> : <span aria-hidden="true">Aa</span>}</button>
        <button aria-label="More reader options" className="reader-chrome__button" onClick={(event) => onMore(event.currentTarget)} type="button"><MoreHorizontal aria-hidden="true" size={20} /></button>
      </div>
    </header>
  )
}
