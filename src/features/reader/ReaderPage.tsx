import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from 'react'
import { BookOpen, Sparkles } from 'lucide-react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { MEDIA_QUERIES, useMediaQuery } from '../../app/responsive'
import { books, currentBook, lookupEvents, vocabularyItems } from '../../mocks'
import { normalizeReaderLocator, readerLocatorAnchorKey, type Bookmark, type DocumentSection, type VocabularyItem } from '../../domain'
import { AdaptivePanel } from './components/AdaptivePanel'
import { DictionaryContent } from './components/DictionaryContent'
import { InteractiveSentence } from './components/InteractiveSentence'
import { ReaderChrome } from './components/ReaderChrome'
import { ReaderChromeRevealZone } from './components/ReaderChromeRevealZone'
import { ReaderMoreMenu } from './components/ReaderMoreMenu'
import { ReadingSettingsPanel } from './components/ReadingSettingsPanel'
import { SentenceAidContent } from './components/SentenceAidContent'
import { readerChapter, sentenceAids, type ReaderSegment } from './fixtures/reader-content'
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
import { createNavigationHistory } from './reader-navigation'
import { useReaderSearchShortcut } from './useReaderSearchShortcut'
import './reader.css'

type ActivePanel =
  | { anchor: HTMLElement; kind: 'dictionary'; vocabularyId: string }
  | { aidId: string; anchor: HTMLElement; kind: 'sentence' }
  | { anchor: HTMLElement; kind: 'settings' }
  | { anchor: HTMLElement; kind: 'more' }

function addToSet(values: Set<string>, value: string): Set<string> { const next = new Set(values); next.add(value); return next }

function ReaderWord({ displayText, item, learnedReminder, onOpen }: { displayText: string; item: VocabularyItem; learnedReminder?: boolean; onOpen: (item: VocabularyItem, anchor: HTMLElement) => void }) {
  return <button className={'reader-word' + (learnedReminder ? ' reader-word--reminder' : '')} onClick={(event: MouseEvent<HTMLButtonElement>) => onOpen(item, event.currentTarget)} type="button">{displayText}</button>
}

export function ReaderPage() {
  const { bookId } = useParams()
  const navigate = useNavigate()
  const isMobile = useMediaQuery(MEDIA_QUERIES.mobile)
  const [activePanel, setActivePanel] = useState<ActivePanel | null>(null)
  const { settings, setSettings } = useReaderSettings()
  const [bookmarksAnchor, setBookmarksAnchor] = useState<HTMLButtonElement>()
  const [searchAnchor, setSearchAnchor] = useState<HTMLButtonElement>()
  const [hasSearchHistory, setHasSearchHistory] = useState(false)
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const { chromeRef, hide, reveal, visible } = useReaderChromeVisibility({ isMobile, overlayOpen: activePanel !== null || Boolean(bookmarksAnchor || searchAnchor) })
  const [lookupCounts, setLookupCounts] = useState<Record<string, number>>(() => Object.fromEntries(vocabularyItems.map((item) => [item.id, lookupEvents.filter((event) => event.vocabularyId === item.id).length])))
  const [acknowledgedIds, setAcknowledgedIds] = useState<Set<string>>(() => new Set())
  const [learningIds, setLearningIds] = useState<Set<string>>(() => new Set(vocabularyItems.filter((item) => item.addedToLearning).map((item) => item.id)))
  const [moreVisible, setMoreVisible] = useState(false)
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
  useReaderExit({ closeOverlay: () => { if (searchAnchor) setSearchAnchor(undefined); else if (bookmarksAnchor) setBookmarksAnchor(undefined); else setActivePanel(null) }, flushLocation, navigateHome: () => navigate('/', { replace: true }), overlayOpen: activePanel !== null || Boolean(bookmarksAnchor || searchAnchor) })

  useReaderSearchShortcut({ enabled: bookId === readerChapter.bookId, open: () => { const anchor = document.querySelector<HTMLButtonElement>('[aria-label="Search in current book"]'); if (anchor) openSearch(anchor) }, focus: () => searchPanelRef.current?.focusAndSelect(), openAlready: Boolean(searchAnchor) })
  if (bookId && !books.some((book) => book.id === bookId)) return <ImportedDocumentReader documentId={bookId} />
  if (!bookId || bookId !== readerChapter.bookId) return <Navigate replace to={'/reader/' + currentBook.id} />

  function exitReader() { if (window.history.length > 1) navigate(-1); else navigate('/') }
  function openDictionary(item: VocabularyItem, anchor: HTMLElement) { setLookupCounts((current) => ({ ...current, [item.id]: (current[item.id] ?? 0) + 1 })); setMoreVisible(false); setBookmarksAnchor(undefined); setActivePanel({ anchor, kind: 'dictionary', vocabularyId: item.id }) }
  function openSentence(aidId: string, anchor: HTMLElement) { setActivePanel({ aidId, anchor, kind: 'sentence' }) }
  function openChromePanel(kind: 'settings' | 'more', anchor: HTMLButtonElement) { setBookmarksAnchor(undefined); setSearchAnchor(undefined); setActivePanel({ anchor, kind }) }
  function currentLocator() { return createLocatorFromCurrentPosition({ resourceKey, sections: mockSections, sectionIndex: 0 }) }
  function currentBookmark() { const locator = currentLocator(); if (!locator) return undefined; const anchorKey = readerLocatorAnchorKey(locator); return bookmarks.find((bookmark) => { const normalized = normalizeReaderLocator(bookmark.locator); return normalized ? readerLocatorAnchorKey(normalized) === anchorKey : false }) }
  async function toggleBookmark() { const locator = currentLocator(); const blockId = locator.kind === 'reflowable' ? locator.blockId : undefined; try { await getBookmarkRepository().toggleAtLocator({ resourceKey, locator, label: readerChapter.chapterLabel, excerpt: mockSections[0].blocks.find((block) => block.id === blockId)?.text.slice(0, 140) }); setBookmarks(await getBookmarkRepository().listForResource(resourceKey)) } catch { /* Local storage is optional; Reader remains usable. */ } }
  function openBookmarks(anchor: HTMLButtonElement) { setActivePanel(null); setSearchAnchor(undefined); setBookmarksAnchor(anchor) }
  function openSearch(anchor: HTMLButtonElement) { setActivePanel(null); setBookmarksAnchor(undefined); setSearchAnchor(anchor) }
  function openBookmark(bookmark: Bookmark) { setBookmarksAnchor(undefined); navigateToLocator(bookmark.locator, { resourceKey, sections: mockSections, sectionIndex: 0 }) }
  function openSearchResult(result: import('./reader-search').ReaderSearchResult) { navigationHistory.current.push(currentLocator()); setHasSearchHistory(true); void saveLocation(); setSearchAnchor(undefined); navigateToLocator(result.locator, { resourceKey, sections: mockSections, sectionIndex: 0, root: articleRef.current ?? undefined }) }
  function backFromSearch() { const previous = navigationHistory.current.back(); if (previous) { setHasSearchHistory(navigationHistory.current.canGoBack()); navigateToLocator(previous, { resourceKey, sections: mockSections, sectionIndex: 0, root: articleRef.current ?? undefined }) } else { setHasSearchHistory(false); exitReader() } }
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
    return <InteractiveSentence key={key} onOpen={(anchor) => openSentence(segment.aidId, anchor)}>{segment.text}</InteractiveSentence>
  }
  const activeVocabulary = activePanel?.kind === 'dictionary' ? vocabularyById.get(activePanel.vocabularyId) : undefined
  const activeSentenceAid = activePanel?.kind === 'sentence' ? sentenceAids[activePanel.aidId] : undefined
  const layout = resolveReaderLayout(settings, isMobile)

  return <div className="reader-shell">
    <ReaderChrome backLabel={hasSearchHistory ? 'Back to previous reading position' : 'Back to Library'} bookTitle={currentBook.title} chapterLabel={readerChapter.chapterLabel} chromeRef={chromeRef} isMobile={isMobile} onBack={backFromSearch} onMore={(anchor) => openChromePanel('more', anchor)} onSettings={(anchor) => openChromePanel('settings', anchor)} onToggleBookmark={() => { void toggleBookmark() }} onOpenBookmarks={openBookmarks} onOpenSearch={openSearch} bookmarkActive={Boolean(currentBookmark())} visible={visible} />
    <ReaderChromeRevealZone onReveal={reveal} visible={visible} />
    <main className="reader-main" onClick={handleReadingAreaClick}>
      <article aria-labelledby="reader-chapter-title" className={`reader-article ${layout.className}`} data-reader-section-id={readerChapter.chapterLabel} lang={readerLanguage('en')} ref={articleRef} style={layout.styleVariables as CSSProperties}>
        <header className="reader-chapter-heading"><div className="reader-chapter-heading__mark"><BookOpen aria-hidden="true" size={16} />{readerChapter.chapterLabel}</div><h1 id="reader-chapter-title" tabIndex={-1}>{readerChapter.chapterTitle}</h1><p>{readerChapter.readingHint}</p></header>
        <div className="reader-prose">{readerChapter.paragraphs.map((paragraph, paragraphIndex) => <p data-reader-block-id={`mock-paragraph-${paragraphIndex}`} key={paragraphIndex}>{paragraph.map((segment, segmentIndex) => renderSegment(segment, paragraphIndex, segmentIndex))}</p>)}</div>
        <footer className="reader-chapter-end"><Sparkles aria-hidden="true" size={15} /><span>A quiet place to stop, whenever you are ready.</span></footer>
      </article>
    </main>
    {activePanel?.kind === 'settings' && <AdaptivePanel anchorElement={activePanel.anchor} isMobile={isMobile} label="Reading settings" onClose={() => setActivePanel(null)} variant="settings"><ReadingSettingsPanel settings={settings} setSettings={setSettings} /></AdaptivePanel>}
    {activePanel?.kind === 'more' && <AdaptivePanel anchorElement={activePanel.anchor} isMobile={isMobile} label="More reader options" onClose={() => setActivePanel(null)} variant="more"><ReaderMoreMenu /></AdaptivePanel>}
    {activePanel && activeVocabulary && <AdaptivePanel anchorElement={activePanel.anchor} isMobile={isMobile} label="Quick meaning" onClose={() => setActivePanel(null)} variant="dictionary"><DictionaryContent acknowledged={acknowledgedIds.has(activeVocabulary.id)} addedToLearning={learningIds.has(activeVocabulary.id)} item={activeVocabulary} lookupCount={lookupCounts[activeVocabulary.id] ?? 1} moreVisible={moreVisible} onAcknowledge={() => setAcknowledgedIds((current) => addToSet(current, activeVocabulary.id))} onAddToLearning={() => setLearningIds((current) => addToSet(current, activeVocabulary.id))} onToggleMore={() => setMoreVisible((current) => !current)} /></AdaptivePanel>}
    {activePanel && activeSentenceAid && <AdaptivePanel anchorElement={activePanel.anchor} isMobile={isMobile} label="Sentence help" onClose={() => setActivePanel(null)} variant="sentence"><SentenceAidContent aid={activeSentenceAid} /></AdaptivePanel>}
    {bookmarksAnchor && <AdaptivePanel anchorElement={bookmarksAnchor} isMobile={isMobile} label="Bookmarks" onClose={() => setBookmarksAnchor(undefined)} variant="bookmarks"><ReaderBookmarksPanel bookmarks={bookmarks} onDelete={(bookmark) => { void getBookmarkRepository().remove(bookmark.id).then(async () => setBookmarks(await getBookmarkRepository().listForResource(resourceKey))).catch(() => undefined) }} onOpen={openBookmark} /></AdaptivePanel>}
    {searchAnchor && <AdaptivePanel anchorElement={searchAnchor} isMobile={isMobile} label="Search in current book" onClose={() => setSearchAnchor(undefined)} variant="search"><ReaderSearchPanel kind="reflowable" onSelect={openSearchResult} ref={searchPanelRef} resourceKey={resourceKey} sections={mockSections} /></AdaptivePanel>}
  </div>
}
