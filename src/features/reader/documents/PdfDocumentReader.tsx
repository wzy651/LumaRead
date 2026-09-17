import { useCallback, useEffect, useState, type CSSProperties, type MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import type { DocumentCapabilities, DocumentSection, ImportedDocument, ReaderLocation } from '../../../domain/documents'
import { AdaptivePanel } from '../components/AdaptivePanel'
import { ReaderChrome } from '../components/ReaderChrome'
import { useReaderChromeVisibility } from '../useReaderChromeVisibility'
import { useReaderSettings } from '../useReaderSettings'
import { resolveReaderLayout } from '../readerLayout'
import { DocumentBlockRenderer } from './DocumentBlockRenderer'
import { PdfPage } from './PdfPage'
import { PdfViewSettingsPanel } from './PdfViewSettingsPanel'
import { clampCustomScale, clampPdfPage } from './pdfScale'
import { usePdfDocument } from './usePdfDocument'
import { usePdfLocation, type PdfLocationState } from './usePdfLocation'

type Props = { document: ImportedDocument; source: Blob; sections: DocumentSection[]; capabilities: DocumentCapabilities; initialLocation?: ReaderLocation; isMobile: boolean; onBack: () => void }
export function PdfDocumentReader({ document: imported, source, sections, capabilities, initialLocation, isMobile, onBack }: Props) {
  const restored = initialLocation?.pdf
  const [state, setState] = useState<PdfLocationState>(() => ({ page: clampPdfPage(restored?.pageNumber ?? (initialLocation?.sectionIndex ?? 0) + 1, sections.length), mode: restored?.mode ?? 'original', zoomMode: restored?.zoomMode ?? (isMobile ? 'fit-width' : 'comfortable'), zoom: clampCustomScale(restored?.zoom ?? 1), rotation: restored?.rotation ?? 0 }))
  const [scale, setScale] = useState(1); const [pageError, setPageError] = useState(false); const [retry, setRetry] = useState(0); const [viewAnchor, setViewAnchor] = useState<HTMLButtonElement>(); const [moreAnchor, setMoreAnchor] = useState<HTMLButtonElement>(); const { document, error } = usePdfDocument(source); const { settings } = useReaderSettings(); const { chromeRef, hide, reveal, visible } = useReaderChromeVisibility({ isMobile, overlayOpen: Boolean(viewAnchor || moreAnchor) })
  usePdfLocation(imported, sections.length, state)
  const changePage = useCallback((next: number) => setState((current) => ({ ...current, page: clampPdfPage(next, sections.length) })), [sections.length])
  const zoom = useCallback((delta: number) => setState((current) => ({ ...current, zoomMode: 'custom', zoom: clampCustomScale((current.zoomMode === 'custom' ? current.zoom : scale) + delta) })), [scale])
  const reportPageError = useCallback(() => setPageError(true), [])
  useEffect(() => { const onKey = (event: globalThis.KeyboardEvent) => { const element = event.target as HTMLElement; if (element.closest('input, textarea, select, button, .reader-panel')) return; if (event.key === 'ArrowLeft' || event.key === 'PageUp') { event.preventDefault(); changePage(state.page - 1) } if (event.key === 'ArrowRight' || event.key === 'PageDown') { event.preventDefault(); changePage(state.page + 1) } }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey) }, [changePage, state.page])
  const clickPage = (event: MouseEvent<HTMLElement>) => { if (event.target !== event.currentTarget) return; if (isMobile) { if (visible) hide(); else reveal() } else reveal() }
  if (error) return <div className="reader-shell reader-message"><h1>Unable to open this PDF</h1><p>{error}</p><Link to="/library">Return to Library</Link></div>
  const label = `Page ${state.page} of ${sections.length}`
  return <div className="reader-shell pdf-reader" onClick={clickPage}><ReaderChrome bookTitle={imported.metadata.title} chapterLabel={label} chromeRef={chromeRef} isMobile={isMobile} onBack={onBack} onMore={(target) => setMoreAnchor(target)} onSettings={(target) => setViewAnchor(target)} pdf visible={visible} />
    {state.mode === 'reading' ? <main className="reader-main"><article className={`reader-article ${resolveReaderLayout(settings, isMobile).className}`} style={resolveReaderLayout(settings, isMobile).styleVariables as CSSProperties}><header className="reader-chapter-heading"><p>Reading view — Beta<br />Complex layouts may change.</p></header><div className="reader-prose"><DocumentBlockRenderer blocks={sections[state.page - 1]?.blocks ?? []} /></div></article></main> : <main className="pdf-reader__stage">{pageError ? <div className="reader-message"><p>This PDF page could not be rendered.</p><button onClick={() => { setPageError(false); setRetry((value) => value + 1) }} type="button">Retry</button><button onClick={onBack} type="button">Return to Library</button></div> : document ? <PdfPage document={document} key={retry} onError={reportPageError} onScale={setScale} pageNumber={state.page} rotation={state.rotation} selectable={capabilities.supportsTextSelection} zoom={state.zoom} zoomMode={state.zoomMode} /> : <p>Loading original layout…</p>}</main>}
    {viewAnchor && <AdaptivePanel anchorElement={viewAnchor} isMobile={isMobile} label="PDF view settings" onClose={() => setViewAnchor(undefined)} variant="settings"><PdfViewSettingsPanel mode={state.zoomMode} onMode={(zoomMode) => setState((current) => ({ ...current, zoomMode }))} onRotate={() => setState((current) => ({ ...current, rotation: (current.rotation + 90) % 360 }))} onZoom={zoom} percent={Math.round(scale * 100)} /></AdaptivePanel>}
    {moreAnchor && <AdaptivePanel anchorElement={moreAnchor} isMobile={isMobile} label="PDF options" onClose={() => setMoreAnchor(undefined)} variant="more"><section className="reader-more-menu"><h2>More</h2><button onClick={() => { setState((current) => ({ ...current, mode: current.mode === 'original' ? 'reading' : 'original' })); setMoreAnchor(undefined) }} disabled={!capabilities.reflowable} type="button">{state.mode === 'original' ? 'Reading view — Beta' : 'Original layout'} {!capabilities.reflowable && <span>No selectable text was found in this PDF.</span>}</button><button disabled={state.page <= 1} onClick={() => changePage(state.page - 1)} type="button">Previous page</button><button disabled={state.page >= sections.length} onClick={() => changePage(state.page + 1)} type="button">Next page</button></section></AdaptivePanel>}
  </div>
}
