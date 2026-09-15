import { useCallback, useEffect, useRef, useState, type CSSProperties, type MouseEvent } from 'react'
import { BookOpen } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import type { DocumentSection, ImportedDocument, ReaderLocation } from '../../../domain/documents'
import { getDocumentRepository } from '../../../storage'
import { AdaptivePanel } from '../components/AdaptivePanel'
import { ReaderChrome } from '../components/ReaderChrome'
import { ReaderMoreMenu } from '../components/ReaderMoreMenu'
import { ReadingSettingsPanel } from '../components/ReadingSettingsPanel'
import { useReaderChromeVisibility } from '../useReaderChromeVisibility'
import { useReaderSettings } from '../useReaderSettings'
import { MEDIA_QUERIES, useMediaQuery } from '../../../app/responsive'

type Loaded = { document: ImportedDocument; sections: DocumentSection[] }
export function ImportedDocumentReader({ documentId }: { documentId: string }) {
  const navigate = useNavigate(); const isMobile = useMediaQuery(MEDIA_QUERIES.mobile); const [loaded, setLoaded] = useState<Loaded>(); const [error, setError] = useState<string>(); const [settingsOpen, setSettingsOpen] = useState<HTMLButtonElement>(); const [moreOpen, setMoreOpen] = useState<HTMLButtonElement>(); const { settings, setSettings } = useReaderSettings(); const { chromeRef, hide, reveal, visible } = useReaderChromeVisibility({ isMobile, overlayOpen: Boolean(settingsOpen || moreOpen) }); const mainRef = useRef<HTMLElement>(null); const locationRef = useRef<ReaderLocation | undefined>(undefined); const timer = useRef<number | undefined>(undefined)
  useEffect(() => { let active = true; void (async () => { try { const record = await getDocumentRepository().getDocument(documentId); if (!record) throw new Error('This document is no longer available.'); const location = await getDocumentRepository().getLocation(documentId); if (active) { setLoaded({ document: record.document, sections: record.sections }); locationRef.current = location } } catch (caught) { if (active) setError(caught instanceof Error ? caught.message : 'LumaRead could not open this document.') } })(); return () => { active = false } }, [documentId])
  const saveLocation = useCallback(() => { const main = mainRef.current; const section = loaded?.sections[0]; if (!main || !section || !loaded) return; const maximum = Math.max(1, document.documentElement.scrollHeight - window.innerHeight); const location: ReaderLocation = { documentId, sectionId: section.id, sectionIndex: 0, progressPercent: Math.min(100, Math.round((window.scrollY / maximum) * 100)), updatedAt: new Date().toISOString() }; locationRef.current = location; void getDocumentRepository().saveLocation(location) }, [documentId, loaded])
  useEffect(() => { if (!loaded) return; const saved = locationRef.current; if (saved?.progressPercent) requestAnimationFrame(() => window.scrollTo({ top: (document.documentElement.scrollHeight - window.innerHeight) * saved.progressPercent / 100 })); const onScroll = () => { window.clearTimeout(timer.current); timer.current = window.setTimeout(saveLocation, 650) }; window.addEventListener('scroll', onScroll, { passive: true }); return () => { window.removeEventListener('scroll', onScroll); window.clearTimeout(timer.current); saveLocation() } }, [loaded, saveLocation])
  function readingAreaClick(event: MouseEvent<HTMLElement>) { if (event.defaultPrevented || window.getSelection()?.toString().trim()) return; const target = event.target as HTMLElement; if (target.closest('.reader-panel')) return; if (isMobile && (target === event.currentTarget || target.classList.contains('reader-article'))) { if (visible) hide(); else reveal() } else if (target === event.currentTarget) reveal() }
  const lineHeight = settings.lineHeight === 'compact' ? (isMobile ? 1.54 : 1.58) : settings.lineHeight === 'relaxed' ? (isMobile ? 1.84 : 1.88) : (isMobile ? 1.68 : 1.72)
  if (error) return <div className="reader-shell reader-message"><h1>Unable to open this document</h1><p>{error}</p><Link to="/library">Return to Library</Link></div>
  if (!loaded) return <div aria-live="polite" className="reader-shell reader-message"><p>Opening your document…</p></div>
  const section = loaded.sections[0]
  return <div className="reader-shell">
    <ReaderChrome bookTitle={loaded.document.metadata.title} chapterLabel={section?.title ?? 'Document'} chromeRef={chromeRef} isMobile={isMobile} onBack={() => navigate('/library')} onMore={(target) => setMoreOpen(target)} onSettings={(target) => setSettingsOpen(target)} visible={visible} />
    <main className="reader-main" onClick={readingAreaClick} ref={mainRef}><article aria-labelledby="reader-chapter-title" className="reader-article" style={{ '--reader-font-scale': settings.fontScale, '--reader-line-height': lineHeight, '--reader-font-family': settings.fontFamily === 'serif' ? 'var(--font-reading)' : 'var(--font-ui)' } as CSSProperties}><header className="reader-chapter-heading"><div className="reader-chapter-heading__mark"><BookOpen aria-hidden="true" size={16} />TXT document</div><h1 id="reader-chapter-title">{loaded.document.metadata.title}</h1></header><div className="reader-prose">{section?.content.map((paragraph, index) => <p key={`${section.id}-${index}`}>{paragraph}</p>)}</div></article></main>
    {settingsOpen && <AdaptivePanel anchorElement={settingsOpen} isMobile={isMobile} label="Reading settings" onClose={() => setSettingsOpen(undefined)} variant="settings"><ReadingSettingsPanel settings={settings} setSettings={setSettings} /></AdaptivePanel>}
    {moreOpen && <AdaptivePanel anchorElement={moreOpen} isMobile={isMobile} label="More reader options" onClose={() => setMoreOpen(undefined)} variant="more"><ReaderMoreMenu /></AdaptivePanel>}
  </div>
}
