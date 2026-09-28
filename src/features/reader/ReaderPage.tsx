import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from 'react'
import { BookOpen, Sparkles } from 'lucide-react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { MEDIA_QUERIES, useMediaQuery } from '../../app/responsive'
import { books, currentBook, vocabularyItems } from '../../mocks'
import { annotationAnchorKey, findAnnotationOverlap, normalizeReaderLocator, readerLocatorAnchorKey, type AnnotationColor, type Bookmark, type DocumentSection, type ReaderAnnotation, type TextAnchorSegment, type VocabularyItem } from '../../domain'
import { AdaptivePanel } from './components/AdaptivePanel'
import { InteractiveSentence } from './components/InteractiveSentence'
import { ReaderChrome } from './components/ReaderChrome'
import { ReaderChromeRevealZone } from './components/ReaderChromeRevealZone'
import { ReaderMoreMenu } from './components/ReaderMoreMenu'
import { ReadingSettingsPanel } from './components/ReadingSettingsPanel'
import { readerChapter, type ReaderSegment } from './fixtures/reader-content'
import { useReaderChromeVisibility } from './useReaderChromeVisibility'
import { useReaderSettings } from './useReaderSettings'
import { shouldToggleReaderChrome } from './readerKeyboard'
import { useReaderExit } from './useReaderExit'
import { ImportedDocumentReader } from './documents/ImportedDocumentReader'
import { readerLanguage, resolveReaderLayout } from './readerLayout'
import { createLocatorFromCurrentPosition, navigateToLocator } from './reader-navigation'
import { ReaderBookmarksPanel } from './components/ReaderBookmarksPanel'
import { ReaderSearchPanel, type ReaderSearchPanelHandle } from './components/ReaderSearchPanel'
import { getBookmarkRepository, getReadingActivityRepository } from '../../storage'
import * as storage from '../../storage'
import { createNavigationHistory } from './reader-navigation'
import { useReaderSearchShortcut } from './useReaderSearchShortcut'
import './reader.css'
import { createTextAnchorFromSelection } from './annotation-anchor'
import { SelectionToolbar } from './components/SelectionToolbar'
import { AnnotationEditor } from './components/AnnotationEditor'
import { HighlightsNotesPanel } from './components/HighlightsNotesPanel'

import { ReadingHelp, type ReadingHelpHandle } from '../learning/ReadingHelp'
import { ReadingSessionTracker } from '../learning/ReadingSessionTracker'

type ActivePanel =
  | { anchor: HTMLElement; kind: 'settings' }
  | { anchor: HTMLElement; kind: 'more' }

function ReaderWord({ displayText, item, learnedReminder, onOpen }: { displayText: string; item: VocabularyItem; learnedReminder?: boolean; onOpen: (item: VocabularyItem, anchor: HTMLElement) => void }) {
  return <button className={'reader-word' + (learnedReminder ? ' reader-word--reminder' : '')} onClick={(event: MouseEvent<HTMLButtonElement>) => onOpen(item, event.currentTarget)} type="button">{displayText}</button>
}

function mockAnnotationRepository() { try { const candidate = storage.getAnnotationRepository; return typeof candidate === 'function' ? candidate() : undefined } catch { return undefined } }

export function ReaderPage() {
  const helpRef = useRef<ReadingHelpHandle>(null)
  const [helpOpen, setHelpOpen] = useState(false)
  const { bookId } = useParams()
  const navigate = useNavigate()
  const isMobile = useMediaQuery(MEDIA_QUERIES.mobile)
  const [activePanel, setActivePanel] = useState<ActivePanel | null>(null)
  const { settings, setSettings } = useReaderSettings()
  const [bookmarksAnchor, setBookmarksAnchor] = useState<HTMLButtonElement>()
  const [annotationsAnchor, setAnnotationsAnchor] = useState<HTMLButtonElement>()
  const [annotations, setAnnotations] = useState<ReaderAnnotation[]>([])
  const [selectionAnchor, setSelectionAnchor] = useState<{ segments: TextAnchorSegment[]; quote: string; anchorKey: string }>()
  const [selectionPosition, setSelectionPosition] = useState<{ top: number; left: number }>()
  const [editor, setEditor] = useState<{ anchor: HTMLElement; annotation?: ReaderAnnotation; pending?: { segments: TextAnchorSegment[]; quote: string; anchorKey: string }; color: AnnotationColor }>()
  const [searchAnchor, setSearchAnchor] = useState<HTMLButtonElement>()
  const [hasSearchHistory, setHasSearchHistory] = useState(false)
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const { chromeRef, hide, reveal, visible } = useReaderChromeVisibility({ isMobile, overlayOpen: helpOpen || activePanel !== null || Boolean(bookmarksAnchor || searchAnchor || annotationsAnchor || editor || selectionAnchor) })
  const [annotationMessage, setAnnotationMessage] = useState<string>()
  const vocabularyById = useMemo(() => new Map(vocabularyItems.map((item) => [item.id, item])), [])
  const mockSections = useMemo<DocumentSection[]>(() => [{ id: readerChapter.chapterLabel, order: 0, blocks: readerChapter.paragraphs.map((paragraph, order) => ({ id: `mock-paragraph-${order}`, type: 'paragraph', text: paragraph.map((segment) => segment.text).join(''), order })) }], [])
  const resourceKey = `builtin:${readerChapter.bookId}`
  const activityTimer = useRef<number | undefined>(undefined)
  const articleRef = useRef<HTMLElement>(null)
  const searchPanelRef = useRef<ReaderSearchPanelHandle>(null)
  const navigationHistory = useRef(createNavigationHistory())
  const saveLocation = useCallback(async () => {
    if (bookId !== readerChapter.bookId) return
    const maximum = Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
    const now = new Date().toISOString()
    await Promise.allSettled([Promise.resolve().then(() => getReadingActivityRepository().recordProgress({ contentKind: 'builtin', documentId: readerChapter.bookId, sectionId: readerChapter.chapterLabel, sectionIndex: 0, locationLabel: readerChapter.chapterLabel, progressPercent: Math.min(100, Math.round(window.scrollY / maximum * 100)), lastReadAt: now }))])
  }, [bookId])
  const flushLocation = useCallback(() => { window.clearTimeout(activityTimer.current); return saveLocation() }, [saveLocation])
  useEffect(() => { if (bookId !== readerChapter.bookId) return; void getReadingActivityRepository().recordOpen('builtin', readerChapter.bookId).catch(() => undefined); const onScroll = () => { window.clearTimeout(activityTimer.current); activityTimer.current = window.setTimeout(() => { void saveLocation() }, 650) }; window.addEventListener('scroll', onScroll, { passive: true }); return () => { window.removeEventListener('scroll', onScroll); window.clearTimeout(activityTimer.current); void saveLocation() } }, [bookId, saveLocation])
  useEffect(() => { if (bookId !== readerChapter.bookId) return; void getBookmarkRepository().listForResource(resourceKey).then(setBookmarks).catch(() => setBookmarks([])) }, [bookId, resourceKey])
  useEffect(() => { if (bookId !== readerChapter.bookId) return; const repository = mockAnnotationRepository(); if (repository) void repository.listForResource(resourceKey).then(setAnnotations).catch(() => setAnnotations([])) }, [bookId, resourceKey])
  useReaderExit({ enabled: bookId === readerChapter.bookId, closeOverlay: () => { if (editor) setEditor(undefined); else if (selectionAnchor) { setSelectionAnchor(undefined); setSelectionPosition(undefined) } else if (searchAnchor) setSearchAnchor(undefined); else if (bookmarksAnchor) setBookmarksAnchor(undefined); else if (annotationsAnchor) setAnnotationsAnchor(undefined); else setActivePanel(null) }, flushLocation, navigateHome: () => navigate('/', { replace: true }), overlayOpen: activePanel !== null || Boolean(bookmarksAnchor || searchAnchor || annotationsAnchor || editor || selectionAnchor) })

  useReaderSearchShortcut({ enabled: bookId === readerChapter.bookId, open: () => { const anchor = document.querySelector<HTMLButtonElement>('[aria-label="Search in current book"]'); if (anchor) openSearch(anchor) }, focus: () => searchPanelRef.current?.focusAndSelect(), openAlready: Boolean(searchAnchor) })
  if (bookId && !books.some((book) => book.id === bookId)) return <ImportedDocumentReader documentId={bookId} />
  if (!bookId || bookId !== readerChapter.bookId) return <Navigate replace to={'/reader/' + currentBook.id} />

  function exitReader() { if (window.history.length > 1) navigate(-1); else navigate('/') }
  function closePanels() { setActivePanel(null); setBookmarksAnchor(undefined); setSearchAnchor(undefined); setAnnotationsAnchor(undefined); setEditor(undefined); clearSelection() }
  function openDictionary(_item: VocabularyItem, anchor: HTMLElement) { helpRef.current?.openText(anchor.textContent ?? '', anchor) }
  function openSentence(anchor: HTMLElement) { helpRef.current?.openText(anchor.textContent ?? '', anchor) }
  function openChromePanel(kind: 'settings' | 'more', anchor: HTMLButtonElement) { closePanels(); setActivePanel({ anchor, kind }) }
  function currentLocator() { return createLocatorFromCurrentPosition({ resourceKey, sections: mockSections, sectionIndex: 0 }) }
  function currentBookmark() { const locator = currentLocator(); if (!locator) return undefined; const anchorKey = readerLocatorAnchorKey(locator); return bookmarks.find((bookmark) => { const normalized = normalizeReaderLocator(bookmark.locator); return normalized ? readerLocatorAnchorKey(normalized) === anchorKey : false }) }
  async function toggleBookmark() { const locator = currentLocator(); const blockId = locator.kind === 'reflowable' ? locator.blockId : undefined; try { await getBookmarkRepository().toggleAtLocator({ resourceKey, locator, label: readerChapter.chapterLabel, excerpt: mockSections[0].blocks.find((block) => block.id === blockId)?.text.slice(0, 140) }); setBookmarks(await getBookmarkRepository().listForResource(resourceKey)) } catch { /* Local storage is optional; Reader remains usable. */ } }
  function openBookmarks(anchor: HTMLButtonElement) { closePanels(); setBookmarksAnchor(anchor) }
  function openSearch(anchor: HTMLButtonElement) { closePanels(); setSearchAnchor(anchor) }
  function openAnnotations(anchor: HTMLButtonElement) { closePanels(); setAnnotationsAnchor(anchor) }
  function openBookmark(bookmark: Bookmark) { setBookmarksAnchor(undefined); navigateToLocator(bookmark.locator, { resourceKey, sections: mockSections, sectionIndex: 0 }) }
  function openSearchResult(result: import('./reader-search').ReaderSearchResult) { navigationHistory.current.push(currentLocator()); setHasSearchHistory(true); void saveLocation(); setSearchAnchor(undefined); navigateToLocator(result.locator, { resourceKey, sections: mockSections, sectionIndex: 0, root: articleRef.current ?? undefined }) }
  function backFromSearch() { const previous = navigationHistory.current.back(); if (previous) { setHasSearchHistory(navigationHistory.current.canGoBack()); navigateToLocator(previous, { resourceKey, sections: mockSections, sectionIndex: 0, root: articleRef.current ?? undefined }) } else { setHasSearchHistory(false); exitReader() } }
  function captureSelection() { const result = createTextAnchorFromSelection(window.getSelection(), { sections: mockSections, root: articleRef.current ?? undefined }); if ('reason' in result) return; const range = window.getSelection()?.getRangeAt(0); if (!range) return; const rect = range.getBoundingClientRect(); setSelectionAnchor(result); setSelectionPosition({ top: isMobile ? 0 : Math.max(12, rect.bottom + 8), left: isMobile ? 0 : Math.min(Math.max(12, rect.left), Math.max(12, window.innerWidth - 360)) }) }
  function clearSelection() { helpRef.current?.close(); window.getSelection()?.removeAllRanges(); setSelectionAnchor(undefined); setSelectionPosition(undefined) }
  async function saveAnnotation(pending: { segments: TextAnchorSegment[]; quote: string; anchorKey: string }, color: AnnotationColor, note?: string) { const repository = mockAnnotationRepository(); if (!repository) { setAnnotationMessage('This highlight could not be saved. You can continue reading.'); return } const existing = annotations.find((annotation) => annotation.anchorKey === annotationAnchorKey(pending.segments)); if (existing) { clearSelection(); setEditor({ anchor: articleRef.current!, annotation: existing, color: existing.color }); return } if (findAnnotationOverlap(annotations, pending.segments)) { setAnnotationMessage('This text overlaps an existing highlight.'); window.setTimeout(() => setAnnotationMessage(undefined), 2400); return } try { await repository.add({ resourceKey, segments: pending.segments, quote: pending.quote, color, note }); setAnnotations(await repository.listForResource(resourceKey)); clearSelection(); setEditor(undefined) } catch { setAnnotationMessage('This highlight could not be saved. You can continue reading.'); window.setTimeout(() => setAnnotationMessage(undefined), 2400) } }
  async function saveEditor(note: string, color: AnnotationColor) { const repository = mockAnnotationRepository(); if (editor?.annotation && repository) { const updated = await repository.update(editor.annotation.id, { note: note.trim() || undefined, color }); if (updated) setAnnotations(await repository.listForResource(resourceKey)); setEditor(undefined) } else if (editor?.pending) await saveAnnotation(editor.pending, color, note.trim() || undefined) }
  function openAnnotation(annotation: ReaderAnnotation, target: HTMLElement) { setAnnotationsAnchor(undefined); clearSelection(); setEditor({ anchor: target, annotation, color: annotation.color }) }
  function handleReadingAreaClick(event: MouseEvent<HTMLElement>) {
    if (!shouldToggleReaderChrome({ currentTarget: event.currentTarget, defaultPrevented: event.defaultPrevented, selectedText: window.getSelection()?.toString() ?? '', target: event.target })) return
    if (isMobile) {
      if (visible) hide()
      else reveal()
    } else reveal()
  }
  function renderSegment(segment: ReaderSegment, paragraphIndex: number, segmentIndex: number) {
    const key = `${paragraphIndex}-${segmentIndex}`
    if (segment.kind === 'text') return <span key={key}>{segment.text}</span>
    if (segment.kind === 'word') { const item = vocabularyById.get(segment.vocabularyId); return item ? <ReaderWord displayText={segment.text} item={item} key={key} learnedReminder={segment.learnedReminder} onOpen={openDictionary} /> : <span key={key}>{segment.text}</span> }
    return <InteractiveSentence key={key} onOpen={openSentence}>{segment.text}</InteractiveSentence>
  }
  function renderMockParagraph(paragraph: ReaderSegment[], paragraphIndex: number) {
    const blockId = `mock-paragraph-${paragraphIndex}`; const text = paragraph.map((segment) => segment.text).join(''); const marks = annotations.flatMap((annotation) => annotation.segments.filter((segment) => segment.sectionId === readerChapter.chapterLabel && segment.blockId === blockId).map((segment) => ({ annotation, start: segment.startOffset, end: segment.endOffset }))).filter((mark) => mark.start >= 0 && mark.end <= text.length && mark.start < mark.end); if (!marks.length) return paragraph.map((segment, segmentIndex) => renderSegment(segment, paragraphIndex, segmentIndex))
    const boundaries = [...new Set([0, text.length, ...marks.flatMap((mark) => [mark.start, mark.end]), ...paragraph.reduce<number[]>((values, segment, index) => { const start = paragraph.slice(0, index).reduce((total, item) => total + item.text.length, 0); values.push(start, start + segment.text.length); return values }, [])])].sort((left, right) => left - right)
    return boundaries.slice(0, -1).map((start, index) => { const end = boundaries[index + 1]; const segmentIndex = paragraph.findIndex((segment, itemIndex) => { const segmentStart = paragraph.slice(0, itemIndex).reduce((total, item) => total + item.text.length, 0); return segmentStart <= start && end <= segmentStart + segment.text.length }); const segment = paragraph[segmentIndex]; const segmentStart = paragraph.slice(0, segmentIndex).reduce((total, item) => total + item.text.length, 0); const rendered = segment ? renderSegment({ ...segment, text: segment.text.slice(start - segmentStart, end - segmentStart) }, paragraphIndex, `${segmentIndex}-${start}` as unknown as number) : text.slice(start, end); const mark = marks.find((candidate) => candidate.start <= start && end <= candidate.end); return mark ? <mark aria-label="Highlighted text. Click to edit." className={`reader-annotation reader-annotation--${mark.annotation.color}`} data-annotation-id={mark.annotation.id} key={`${mark.annotation.id}-${start}`} onClick={(event) => openAnnotation(mark.annotation, event.currentTarget)} role="button" tabIndex={0}>{rendered}</mark> : <span key={`${paragraphIndex}-${start}`}>{rendered}</span> })
  }
  const layout = resolveReaderLayout(settings, isMobile)

  return <div className="reader-shell">
    <ReadingSessionTracker resourceKey={resourceKey} bookTitle={currentBook.title} />
    <ReaderChrome backLabel={hasSearchHistory ? 'Back to previous reading position' : 'Back to Library'} bookTitle={currentBook.title} chapterLabel={readerChapter.chapterLabel} chromeRef={chromeRef} isMobile={isMobile} onBack={backFromSearch} onMore={(anchor) => openChromePanel('more', anchor)} onSettings={(anchor) => openChromePanel('settings', anchor)} onToggleBookmark={() => { clearSelection(); setEditor(undefined); void toggleBookmark() }} onOpenBookmarks={openBookmarks} onOpenSearch={openSearch} bookmarkActive={Boolean(currentBookmark())} visible={visible} />
    <ReaderChromeRevealZone onReveal={reveal} visible={visible} />
    <ReadingHelp ref={helpRef} resourceKey={resourceKey} bookTitle={currentBook.title} sectionId={readerChapter.chapterLabel} isMobile={isMobile} otherPanelOpen={Boolean(activePanel || bookmarksAnchor || searchAnchor || annotationsAnchor || editor)} onOpen={closePanels} onActiveChange={setHelpOpen} />
    <main className="reader-main" onClick={handleReadingAreaClick} onPointerUp={captureSelection}>
      <article aria-labelledby="reader-chapter-title" className={`reader-article ${layout.className}`} data-reader-section-id={readerChapter.chapterLabel} lang={readerLanguage('en')} ref={articleRef} style={layout.styleVariables as CSSProperties}>
        <header className="reader-chapter-heading"><div className="reader-chapter-heading__mark"><BookOpen aria-hidden="true" size={16} />{readerChapter.chapterLabel}</div><h1 id="reader-chapter-title" tabIndex={-1}>{readerChapter.chapterTitle}</h1><p>{readerChapter.readingHint}</p></header>
        <div className="reader-prose">{readerChapter.paragraphs.map((paragraph, paragraphIndex) => <p data-reader-block-id={`mock-paragraph-${paragraphIndex}`} key={paragraphIndex}>{renderMockParagraph(paragraph, paragraphIndex)}</p>)}</div>
        <footer className="reader-chapter-end"><Sparkles aria-hidden="true" size={15} /><span>A quiet place to stop, whenever you are ready.</span></footer>
      </article>
    </main>
    {annotationMessage && <p aria-live="polite" className="reader-annotation-message">{annotationMessage}</p>}
    {activePanel?.kind === 'settings' && <AdaptivePanel anchorElement={activePanel.anchor} isMobile={isMobile} label="Reading settings" onClose={() => setActivePanel(null)} variant="settings"><ReadingSettingsPanel settings={settings} setSettings={setSettings} /></AdaptivePanel>}
    {selectionAnchor && selectionPosition && <div className={`selection-toolbar-host${isMobile ? ' selection-toolbar-host--mobile' : ''}`} style={isMobile ? undefined : selectionPosition}><SelectionToolbar onLookup={() => helpRef.current?.openSelection()} isMobile={isMobile} onAddNote={() => { if (selectionAnchor && articleRef.current) { const pending = selectionAnchor; setSelectionAnchor(undefined); setSelectionPosition(undefined); setEditor({ anchor: articleRef.current, pending, color: 'lavender' }) } }} onCancel={clearSelection} onHighlight={(color) => { void saveAnnotation(selectionAnchor, color) }} /></div>}
    {activePanel?.kind === 'more' && <AdaptivePanel anchorElement={activePanel.anchor} isMobile={isMobile} label="More reader options" onClose={() => setActivePanel(null)} variant="more"><ReaderMoreMenu onOpenAnnotations={() => openAnnotations(activePanel.anchor as HTMLButtonElement)} /></AdaptivePanel>}
    {bookmarksAnchor && <AdaptivePanel anchorElement={bookmarksAnchor} isMobile={isMobile} label="Bookmarks" onClose={() => setBookmarksAnchor(undefined)} variant="bookmarks"><ReaderBookmarksPanel bookmarks={bookmarks} onDelete={(bookmark) => { void getBookmarkRepository().remove(bookmark.id).then(async () => setBookmarks(await getBookmarkRepository().listForResource(resourceKey))).catch(() => undefined) }} onOpen={openBookmark} /></AdaptivePanel>}
    {annotationsAnchor && <AdaptivePanel anchorElement={annotationsAnchor} isMobile={isMobile} label="Highlights & Notes" onClose={() => setAnnotationsAnchor(undefined)} variant="more"><HighlightsNotesPanel annotations={annotations} locationLabel={() => readerChapter.chapterLabel} onDelete={(annotation) => { const repository = mockAnnotationRepository(); if (repository) void repository.remove(annotation.id).then(async () => setAnnotations(await repository.listForResource(resourceKey))) }} onEdit={(annotation) => { setAnnotationsAnchor(undefined); setEditor({ anchor: articleRef.current!, annotation, color: annotation.color }) }} onOpen={(annotation) => { const first = annotation.segments[0]; const target = first ? articleRef.current?.querySelector<HTMLElement>(`[data-reader-block-id="${first.blockId}"]`) : undefined; if (target) { target.scrollIntoView({ block: 'center' }); openAnnotation(annotation, target) } }} /></AdaptivePanel>}
    {editor && <AdaptivePanel anchorElement={editor.anchor} isMobile={isMobile} label={editor.annotation ? 'Edit highlight' : 'Add note'} onClose={() => setEditor(undefined)} variant="more"><AnnotationEditor annotation={editor.annotation} color={editor.color} note={editor.annotation?.note} onCancel={() => setEditor(undefined)} onColor={(color) => setEditor((current) => current ? { ...current, color } : current)} onDelete={editor.annotation ? () => { const repository = mockAnnotationRepository(); if (repository) void repository.remove(editor.annotation!.id).then(async () => { setAnnotations(await repository.listForResource(resourceKey)); setEditor(undefined) }) } : undefined} onSave={(note, color) => { void saveEditor(note, color) }} quote={editor.annotation?.quote ?? editor.pending?.quote ?? ''} /></AdaptivePanel>}
    {searchAnchor && <AdaptivePanel anchorElement={searchAnchor} isMobile={isMobile} label="Search in current book" onClose={() => setSearchAnchor(undefined)} variant="search"><ReaderSearchPanel kind="reflowable" onSelect={openSearchResult} ref={searchPanelRef} resourceKey={resourceKey} sections={mockSections} /></AdaptivePanel>}
  </div>
}
