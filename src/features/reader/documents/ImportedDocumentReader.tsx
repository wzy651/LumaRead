import { useCallback, useEffect, useRef, useState, type CSSProperties, type MouseEvent } from 'react'
import { BookOpen } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { normalizeReaderLocator, readerLocatorAnchorKey, type Bookmark, type DocumentSection, type ImportedDocument, type ReaderLocation, type ReaderLocator } from '../../../domain'
import { getBookmarkRepository, getDocumentRepository, getReadingActivityRepository } from '../../../storage'
import { AdaptivePanel } from '../components/AdaptivePanel'
import { ReaderChrome } from '../components/ReaderChrome'
import { ReaderChromeRevealZone } from '../components/ReaderChromeRevealZone'
import { ReaderMoreMenu } from '../components/ReaderMoreMenu'
import { ReadingSettingsPanel } from '../components/ReadingSettingsPanel'
import { useReaderChromeVisibility } from '../useReaderChromeVisibility'
import { useReaderSettings } from '../useReaderSettings'
import { shouldToggleReaderChrome } from '../readerKeyboard'
import { useReaderExit } from '../useReaderExit'
import { useReaderKeyboardNavigation } from '../useReaderKeyboardNavigation'
import { MEDIA_QUERIES, useMediaQuery } from '../../../app/responsive'
import { resolveSectionIndex } from './section-location'
import { DocumentBlockRenderer } from './DocumentBlockRenderer'
import { readerLanguage, resolveReaderLayout } from '../readerLayout'
import { PdfDocumentReader } from './PdfDocumentReader'
import { ReaderBookmarksPanel } from '../components/ReaderBookmarksPanel'
import { createLocatorFromCurrentPosition, navigateToLocator } from '../reader-navigation'

type Loaded = { document: ImportedDocument; source: Blob; sections: DocumentSection[]; capabilities: import('../../../domain/documents').DocumentCapabilities; location?: ReaderLocation }
export function ImportedDocumentReader({ documentId }: { documentId: string }) {
  const navigate = useNavigate(); const isMobile = useMediaQuery(MEDIA_QUERIES.mobile); const [loaded, setLoaded] = useState<Loaded>(); const [error, setError] = useState<string>(); const [sectionIndex, setSectionIndex] = useState(0); const [settingsOpen, setSettingsOpen] = useState<HTMLButtonElement>(); const [moreOpen, setMoreOpen] = useState<HTMLButtonElement>(); const [tocOpen, setTocOpen] = useState<HTMLButtonElement>(); const [bookmarksOpen, setBookmarksOpen] = useState<HTMLButtonElement>(); const [bookmarks, setBookmarks] = useState<Bookmark[]>([]); const { settings, setSettings } = useReaderSettings(); const { chromeRef, hide, reveal, visible } = useReaderChromeVisibility({ isMobile, overlayOpen: Boolean(settingsOpen || moreOpen || tocOpen || bookmarksOpen) }); const locations = useRef(new Map<string, ReaderLocation>()); const timer = useRef<number | undefined>(undefined); const pendingLocator = useRef<ReaderLocator | undefined>(undefined)
  useEffect(() => { let active = true; void (async () => { try { const repository = getDocumentRepository(); const [record, location] = await Promise.all([repository.getDocument(documentId), repository.getLocation(documentId)]); if (!record) throw new Error('This document is no longer available.'); if (!active) return; if (location) locations.current.set(location.sectionId, location); setLoaded({ document: record.document, source: record.source, sections: record.sections, capabilities: record.capabilities, location }); setSectionIndex(resolveSectionIndex(record.sections, location)); void getReadingActivityRepository().recordOpen('imported', documentId).catch(() => undefined) } catch (caught) { if (active) setError(caught instanceof Error ? caught.message : 'LumaRead could not open this document.') } })(); return () => { active = false } }, [documentId])
  const resourceKey = `imported:${documentId}`
  useEffect(() => { void getBookmarkRepository().listForResource(resourceKey).then(setBookmarks).catch(() => setBookmarks([])) }, [resourceKey])
  const saveLocation = useCallback(async () => {
    const section = loaded?.sections[sectionIndex]
    if (!section || !loaded) return
    const maximum = Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
    const now = new Date().toISOString()
    const location: ReaderLocation = { documentId, sectionId: section.id, sectionIndex, progressPercent: Math.min(100, Math.round((window.scrollY / maximum) * 100)), updatedAt: now }
    locations.current.set(section.id, location)
    const locationLabel = loaded.document.format === 'pdf' ? `Page ${sectionIndex + 1} of ${loaded.sections.length}` : section.title ?? `Section ${sectionIndex + 1}`
    await Promise.allSettled([
      Promise.resolve().then(() => getDocumentRepository().saveLocation(location)),
      Promise.resolve().then(() => getReadingActivityRepository().recordProgress({ contentKind: 'imported', documentId, sectionId: section.id, sectionIndex, locationLabel, progressPercent: loaded.document.format === 'txt' ? location.progressPercent : undefined, lastReadAt: now })),
    ])
  }, [documentId, loaded, sectionIndex])
  const flushLocation = useCallback(() => { window.clearTimeout(timer.current); return saveLocation() }, [saveLocation])
  useEffect(() => { if (!loaded) return; const saved = locations.current.get(loaded.sections[sectionIndex]?.id ?? ''); const frame = window.requestAnimationFrame(() => { window.scrollTo({ top: saved ? Math.max(0, document.documentElement.scrollHeight - window.innerHeight) * saved.progressPercent / 100 : 0 }); document.getElementById('reader-chapter-title')?.focus({ preventScroll: true }) }); const onScroll = () => { window.clearTimeout(timer.current); timer.current = window.setTimeout(() => { void saveLocation() }, 650) }; window.addEventListener('scroll', onScroll, { passive: true }); return () => { window.cancelAnimationFrame(frame); window.removeEventListener('scroll', onScroll); window.clearTimeout(timer.current); void saveLocation() } }, [loaded, saveLocation, sectionIndex])
  useEffect(() => { const locator = pendingLocator.current; if (!locator || !loaded) return; pendingLocator.current = undefined; const frame = window.requestAnimationFrame(() => navigateToLocator(locator, { resourceKey, sections: loaded.sections, sectionIndex })); return () => window.cancelAnimationFrame(frame) }, [loaded, resourceKey, sectionIndex])
  const changeSection = useCallback((next: number) => { void saveLocation(); setSectionIndex(next); setTocOpen(undefined) }, [saveLocation])
  useReaderKeyboardNavigation({ enabled: Boolean(loaded && loaded.document.format !== 'pdf'), onSectionChange: changeSection, sectionCount: loaded?.sections.length ?? 0, sectionIndex })
  useReaderExit({ closeOverlay: () => { if (bookmarksOpen) setBookmarksOpen(undefined); else if (tocOpen) setTocOpen(undefined); else if (moreOpen) setMoreOpen(undefined); else setSettingsOpen(undefined) }, enabled: Boolean(loaded && !(loaded.document.format === 'pdf' && loaded.capabilities.supportsOriginalLayout)), flushLocation, navigateHome: () => navigate('/', { replace: true }), overlayOpen: Boolean(settingsOpen || moreOpen || tocOpen || bookmarksOpen) })
  function currentLocator() { return loaded ? createLocatorFromCurrentPosition({ resourceKey, sections: loaded.sections, sectionIndex }) : undefined }
  function currentBookmark() { const locator = currentLocator(); if (!locator) return undefined; const anchorKey = readerLocatorAnchorKey(locator); return bookmarks.find((bookmark) => { const normalized = normalizeReaderLocator(bookmark.locator); return normalized ? readerLocatorAnchorKey(normalized) === anchorKey : false }) }
  async function toggleBookmark() { const locator = currentLocator(); if (!locator) return; const blockId = locator.kind === 'reflowable' ? locator.blockId : undefined; try { await getBookmarkRepository().toggleAtLocator({ resourceKey, locator, label: loaded?.sections[sectionIndex]?.title ?? `Section ${sectionIndex + 1}`, excerpt: loaded?.sections[sectionIndex]?.blocks.find((block) => block.id === blockId)?.text.slice(0, 140) }); setBookmarks(await getBookmarkRepository().listForResource(resourceKey)) } catch { /* Local storage is optional; Reader remains usable. */ } }
  function openBookmarks(anchor: HTMLButtonElement) { setSettingsOpen(undefined); setMoreOpen(undefined); setTocOpen(undefined); setBookmarksOpen(anchor) }
  function openBookmark(bookmark: Bookmark) { setBookmarksOpen(undefined); if (!loaded) return; navigateToLocator(bookmark.locator, { resourceKey, sections: loaded.sections, sectionIndex, onSectionChange: (index) => { pendingLocator.current = bookmark.locator; setSectionIndex(index) } }) }
  function readingAreaClick(event: MouseEvent<HTMLElement>) { if (!shouldToggleReaderChrome({ currentTarget: event.currentTarget, defaultPrevented: event.defaultPrevented, selectedText: window.getSelection()?.toString() ?? '', target: event.target })) return; if (isMobile) { if (visible) hide(); else reveal() } else reveal() }
  const layout = resolveReaderLayout(settings, isMobile)
  if (error) return <div className="reader-shell reader-message"><h1>Unable to open this document</h1><p>{error}</p><Link to="/library">Return to Library</Link></div>
  if (!loaded) return <div aria-live="polite" className="reader-shell reader-message"><p>Opening your document…</p></div>
  if (loaded.document.format === 'pdf' && loaded.capabilities.supportsOriginalLayout) return <PdfDocumentReader capabilities={loaded.capabilities} document={loaded.document} initialLocation={loaded.location} isMobile={isMobile} navigateHome={() => navigate('/', { replace: true })} onBack={() => navigate('/library')} sections={loaded.sections} source={loaded.source} />
  const section = loaded.sections[sectionIndex] ?? loaded.sections[0]
  return <div className="reader-shell"><ReaderChrome bookTitle={loaded.document.metadata.title} chapterLabel={section?.title ?? `Section ${(sectionIndex + 1)}`} chromeRef={chromeRef} isMobile={isMobile} onBack={() => navigate('/library')} onMore={(target) => { setSettingsOpen(undefined); setMoreOpen(target) }} onSettings={(target) => { setMoreOpen(undefined); setBookmarksOpen(undefined); setSettingsOpen(target) }} onToggleBookmark={() => { void toggleBookmark() }} onOpenBookmarks={openBookmarks} bookmarkActive={Boolean(currentBookmark())} visible={visible} /><ReaderChromeRevealZone onReveal={reveal} visible={visible} />
    <main className="reader-main" onClick={readingAreaClick}><article aria-labelledby="reader-chapter-title" className={`reader-article ${layout.className}`} lang={readerLanguage(loaded.document.metadata.language)} style={layout.styleVariables as CSSProperties}><header className="reader-chapter-heading"><div className="reader-chapter-heading__mark"><BookOpen aria-hidden="true" size={16} />{loaded.document.format.toUpperCase()} document</div><h1 id="reader-chapter-title" tabIndex={-1}>{section?.title ?? loaded.document.metadata.title}</h1></header><div className="reader-prose"><DocumentBlockRenderer blocks={section?.blocks ?? []} /></div>{loaded.sections.length > 1 && <nav aria-label="Document sections" className="reader-section-nav"><button disabled={sectionIndex === 0} onClick={() => changeSection(sectionIndex - 1)} type="button">Previous</button><span>{sectionIndex + 1} / {loaded.sections.length}</span><button disabled={sectionIndex === loaded.sections.length - 1} onClick={() => changeSection(sectionIndex + 1)} type="button">Next</button></nav>}</article></main>
    {settingsOpen && <AdaptivePanel anchorElement={settingsOpen} isMobile={isMobile} label="Reading settings" onClose={() => setSettingsOpen(undefined)} variant="settings"><ReadingSettingsPanel settings={settings} setSettings={setSettings} /></AdaptivePanel>}
    {moreOpen && <AdaptivePanel anchorElement={moreOpen} isMobile={isMobile} label="More reader options" onClose={() => setMoreOpen(undefined)} variant="more"><ReaderMoreMenu capabilities={loaded.capabilities} canOpenTableOfContents={loaded.sections.length > 1} importedDocument onOpenTableOfContents={() => { setTocOpen(moreOpen); setMoreOpen(undefined) }} onReturnToLibrary={saveLocation} /></AdaptivePanel>}
    {tocOpen && <AdaptivePanel anchorElement={tocOpen} isMobile={isMobile} label="Table of contents" onClose={() => setTocOpen(undefined)} variant="toc"><nav className="reader-toc">{loaded.sections.map((item, index) => <button aria-current={index === sectionIndex ? 'page' : undefined} key={item.id} onClick={() => changeSection(index)} type="button">{item.title ?? `Section ${index + 1}`}</button>)}</nav></AdaptivePanel>}
    {bookmarksOpen && <AdaptivePanel anchorElement={bookmarksOpen} isMobile={isMobile} label="Bookmarks" onClose={() => setBookmarksOpen(undefined)} variant="bookmarks"><ReaderBookmarksPanel bookmarks={bookmarks} onDelete={(bookmark) => { void getBookmarkRepository().remove(bookmark.id).then(async () => setBookmarks(await getBookmarkRepository().listForResource(resourceKey))).catch(() => undefined) }} onOpen={openBookmark} /></AdaptivePanel>}
  </div>
}
