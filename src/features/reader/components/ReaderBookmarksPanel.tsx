import { Trash2 } from 'lucide-react'
import type { Bookmark } from '../../../domain'

interface ReaderBookmarksPanelProps {
  bookmarks: Bookmark[]
  onDelete: (bookmark: Bookmark) => void
  onOpen: (bookmark: Bookmark) => void
}

function createdLabel(timestamp: number) {
  try { return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(timestamp) } catch { return '' }
}

export function ReaderBookmarksPanel({ bookmarks, onDelete, onOpen }: ReaderBookmarksPanelProps) {
  if (!bookmarks.length) return <p className="reader-bookmarks__empty">No bookmarks yet.</p>
  return <div className="reader-bookmarks__list">{bookmarks.map((bookmark) => <div className="reader-bookmark" key={bookmark.id}>
    <button className="reader-bookmark__open" onClick={() => onOpen(bookmark)} type="button"><strong>{bookmark.label ?? (bookmark.locator.kind === 'pdf' ? `Page ${bookmark.locator.pageNumber}` : 'Reading position')}</strong>{bookmark.excerpt && <span>{bookmark.excerpt}</span>}<small>{createdLabel(bookmark.createdAt)}</small></button>
    <button aria-label={`Delete bookmark ${bookmark.label ?? ''}`.trim()} className="reader-bookmark__delete" onClick={() => onDelete(bookmark)} type="button"><Trash2 aria-hidden="true" size={17} /></button>
  </div>)}</div>
}
