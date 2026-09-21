import { useCallback, useEffect, useRef, useState, type CSSProperties, type MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import { normalizeReaderLocator, readerLocatorAnchorKey, type Bookmark, type DocumentCapabilities, type DocumentSection, type ImportedDocument, type ReaderLocation } from '../../../domain'
import { getBookmarkRepository } from '../../../storage'
import { AdaptivePanel } from '../components/AdaptivePanel'
import { ReaderChrome } from '../components/ReaderChrome'
import { ReaderChromeRevealZone } from '../components/ReaderChromeRevealZone'
import { isReaderKeyboardEventBlocked, shouldToggleReaderChrome } from '../readerKeyboard'
import { useReaderExit } from '../useReaderExit'
import { useReaderChromeVisibility } from '../useReaderChromeVisibility'
import { useReaderSettings } from '../useReaderSettings'
import { useElementSize } from '../useElementSize'
import { resolveReaderLayout } from '../readerLayout'
import { DocumentBlockRenderer } from './DocumentBlockRenderer'
import { PdfPage } from './PdfPage'
import { PdfPageNavigation } from './PdfPageNavigation'
import { PdfViewSettingsPanel } from './PdfViewSettingsPanel'
import { clampCustomScale, clampPdfPage } from './pdfScale'
import { usePdfDocument } from './usePdfDocument'
import { usePdfLocation, type PdfLocationState } from './usePdfLocation'
import { ReaderBookmarksPanel } from '../components/ReaderBookmarksPanel'

type Props = { document: ImportedDocument; source: Blob; sections: DocumentSection[]; capabilities: DocumentCapabilities; initialLocation?: ReaderLocation; isMobile: boolean; onBack: () => void; navigateHome?: () => void }
export function PdfDocumentReader({ document: imported, source, sections, capabilities, initialLocation, isMobile, onBack, navigateHome }: Props) {
  const exitHome = navigateHome ?? onBack
  const restored = initialLocation?.pdf
  const [state, setState] = useState<PdfLocationState>(() => ({ page: clampPdfPage(restored?.pageNumber ?? (initialLocation?.sectionIndex ?? 0) + 1, sections.length), mode: restored?.mode ?? 'original', zoomMode: restored?.zoomMode ?? (isMobile ? 'fit-width' : 'comfortable'), zoom: clampCustomScale(restored?.zoom ?? 1), rotation: restored?.rotation ?? 0 }))
  const [scale, setScale] = useState(1); const [pageError, setPageError] = useState(false); const [retry, setRetry] = useState(0); const [viewAnchor, setViewAnchor] = useState<HTMLButtonElement>(); const [moreAnchor, setMoreAnchor] = useState<HTMLButtonElement>(); const [bookmarksAnchor, setBookmarksAnchor] = useState<HTMLButtonElement>(); const [bookmarks, setBookmarks] = useState<Bookmark[]>([]); const stageRef = useRef<HTMLElement>(null); const stageSize = useElementSize(stageRef); const { document, error } = usePdfDocument(source); const { settings } = useReaderSettings(); const { chromeRef, hide, reveal, visible } = useReaderChromeVisibility({ isMobile, overlayOpen: Boolean(viewAnchor || moreAnchor || bookmarksAnchor) })
  const flushLocation = usePdfLocation(imported, sections.length, state)
  const resourceKey = `imported:${imported.id}`
  useEffect(() => { void getBookmarkRepository().listForResource(resourceKey).then(setBookmarks).catch(() => setBookmarks([])) }, [resourceKey])
  const changePageBy = useCallback((delta: number) => setState((current) => ({ ...current, page: clampPdfPage(current.page + delta, sections.length) })), [sections.length])
  const zoom = useCallback((delta: number) => setState((current) => ({ ...current, zoomMode: 'custom', zoom: clampCustomScale((current.zoomMode === 'custom' ? current.zoom : scale) + delta) })), [scale])
  const reportPageError = useCallback(() => setPageError(true), [])
  useReaderExit({ closeOverlay: () => { if (bookmarksAnchor) setBookmarksAnchor(undefined); else if (moreAnchor) setMoreAnchor(undefined); else setViewAnchor(undefined) }, flushLocation, navigateHome: exitHome, overlayOpen: Boolean(viewAnchor || moreAnchor || bookmarksAnchor) })
  function currentLocator() { return { version: 1 as const, kind: 'pdf' as const, resourceKey, pageNumber: state.page } }
  function currentBookmark() { const locator = currentLocator(); const anchorKey = readerLocatorAnchorKey(locator); return bookmarks.find((bookmark) => { const normalized = normalizeReaderLocator(bookmark.locator); return normalized ? readerLocatorAnchorKey(normalized) === anchorKey : false }) }
  async function toggleBookmark() { const locator = currentLocator(); try { await getBookmarkRepository().toggleAtLocator({ resourceKey, locator, label: `Page ${state.page}`, excerpt: sections[state.page - 1]?.blocks[0]?.text.slice(0, 140) }); setBookmarks(await getBookmarkRepository().listForResource(resourceKey)) } catch { /* Local storage is optional; Reader remains usable. */ } }
  function openBookmarks(anchor: HTMLButtonElement) { setViewAnchor(undefined); setMoreAnchor(undefined); setBookmarksAnchor(anchor) }
  function openBookmark(bookmark: Bookmark) { setBookmarksAnchor(undefined); if (bookmark.locator.kind !== 'pdf') return; const pageNumber = bookmark.locator.pageNumber; setState((current) => ({ ...current, page: clampPdfPage(pageNumber, sections.length) })); window.requestAnimationFrame(() => stageRef.current?.scrollTo({ top: 0, behavior: 'auto' })) }
  useEffect(() => { const onKey = (event: globalThis.KeyboardEvent) => { if (event.repeat || isReaderKeyboardEventBlocked(event)) return; if (event.key === 'ArrowLeft' || event.key === 'PageUp') { event.preventDefault(); changePageBy(-1) } if (event.key === 'ArrowRight' || event.key === 'PageDown') { event.preventDefault(); changePageBy(1) } }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey) }, [changePageBy])
  const clickPage = (event: MouseEvent<HTMLElement>) => { if (!shouldToggleReaderChrome({ currentTarget: event.currentTarget, defaultPrevented: event.defaultPrevented, selectedText: window.getSelection()?.toString() ?? '', target: event.target })) return; if (isMobile) { if (visible) hide(); else reveal() } else reveal() }
  if (error) return <div className="reader-shell reader-message"><h1>Unable to open this PDF</h1><p>{error}</p><Link to="/library">Return to Library</Link></div>
  const label = `Page ${state.page} of ${sections.length}`
  const layout = resolveReaderLayout(settings, isMobile)
  const effectiveZoomMode = state.zoomMode === 'comfortable' && isMobile ? 'fit-width' : state.zoomMode
  return <div className="reader-shell pdf-reader" onClick={clickPage}><ReaderChrome bookTitle={imported.metadata.title} chapterLabel={label} chromeRef={chromeRef} isMobile={isMobile} onBack={onBack} onMore={(target) => { setViewAnchor(undefined); setBookmarksAnchor(undefined); setMoreAnchor(target) }} onSettings={(target) => { setMoreAnchor(undefined); setBookmarksAnchor(undefined); setViewAnchor(target) }} onToggleBookmark={() => { void toggleBookmark() }} onOpenBookmarks={openBookmarks} bookmarkActive={Boolean(currentBookmark())} pdf visible={visible} /><ReaderChromeRevealZone onReveal={reveal} visible={visible} />
    {state.mode === 'reading' ? <main className="reader-main"><article className={`reader-article ${layout.className}`} style={layout.styleVariables as CSSProperties}><header className="reader-chapter-heading"><p>Reading view — Beta<br />Complex layouts may change.</p></header><div className="reader-prose"><DocumentBlockRenderer blocks={sections[state.page - 1]?.blocks ?? []} /></div></article></main> : <main className="pdf-reader__stage" ref={stageRef}><PdfPageNavigation chromeVisible={visible} isMobile={isMobile} onNext={() => changePageBy(1)} onPrevious={() => changePageBy(-1)} page={state.page} total={sections.length} />{pageError ? <div className="reader-message"><p>This PDF page could not be rendered.</p><button onClick={() => { setPageError(false); setRetry((value) => value + 1) }} type="button">Retry</button><button onClick={onBack} type="button">Return to Library</button></div> : document ? <PdfPage availableSize={stageSize} document={document} key={retry} onError={reportPageError} onScale={setScale} pageNumber={state.page} rotation={state.rotation} selectable={capabilities.supportsTextSelection} zoom={state.zoom} zoomMode={effectiveZoomMode} /> : <p>Loading original layout…</p>}</main>}
    {viewAnchor && <AdaptivePanel anchorElement={viewAnchor} isMobile={isMobile} label="PDF view settings" onClose={() => setViewAnchor(undefined)} variant="settings"><PdfViewSettingsPanel mode={state.zoomMode} onMode={(zoomMode) => setState((current) => ({ ...current, zoomMode }))} onRotate={() => setState((current) => ({ ...current, rotation: (current.rotation + 90) % 360 }))} onZoom={zoom} percent={Math.round(scale * 100)} /></AdaptivePanel>}
    {moreAnchor && <AdaptivePanel anchorElement={moreAnchor} isMobile={isMobile} label="PDF options" onClose={() => setMoreAnchor(undefined)} variant="more"><section className="reader-more-menu"><h2>More</h2><button onClick={() => { setState((current) => ({ ...current, mode: current.mode === 'original' ? 'reading' : 'original' })); setMoreAnchor(undefined) }} disabled={!capabilities.reflowable} type="button">{state.mode === 'original' ? 'Reading view — Beta' : 'Original layout'} {!capabilities.reflowable && <span>No selectable text was found. OCR reading view is not available yet.</span>}</button><button disabled={state.page <= 1} onClick={() => changePageBy(-1)} type="button">Previous page</button><button disabled={state.page >= sections.length} onClick={() => changePageBy(1)} type="button">Next page</button></section></AdaptivePanel>}
    {bookmarksAnchor && <AdaptivePanel anchorElement={bookmarksAnchor} isMobile={isMobile} label="Bookmarks" onClose={() => setBookmarksAnchor(undefined)} variant="bookmarks"><ReaderBookmarksPanel bookmarks={bookmarks} onDelete={(bookmark) => { void getBookmarkRepository().remove(bookmark.id).then(async () => setBookmarks(await getBookmarkRepository().listForResource(resourceKey))).catch(() => undefined) }} onOpen={openBookmark} /></AdaptivePanel>}
  </div>
}
