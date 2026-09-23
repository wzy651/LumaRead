// @vitest-environment jsdom
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReaderAnnotation, ReaderLocation } from '../../../domain'
import type { DocumentCapabilities, DocumentSection, ImportedDocument } from '../../../domain/documents'
import { PdfDocumentReader } from './PdfDocumentReader'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const readerMock = vi.hoisted(() => ({
  pdfDocument: undefined as object | undefined,
  pageRenders: 0,
  annotations: [] as unknown[],
  updateAnnotation: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('./usePdfDocument', () => ({ usePdfDocument: () => ({ document: readerMock.pdfDocument, error: undefined }) }))
vi.mock('./usePdfLocation', () => ({ usePdfLocation: () => vi.fn() }))
vi.mock('../../../storage', () => ({ getBookmarkRepository: () => ({ listForResource: vi.fn().mockResolvedValue([]), toggleAtLocator: vi.fn(), remove: vi.fn() }), getAnnotationRepository: () => ({ listForResource: async () => readerMock.annotations as ReaderAnnotation[], update: readerMock.updateAnnotation, remove: vi.fn().mockResolvedValue(undefined), add: vi.fn() }) }))
vi.mock('../useReaderSettings', () => ({ useReaderSettings: () => ({ settings: { fontFamily: 'serif', fontScale: 1, lineHeight: 'comfortable', textWidthCh: 64, mobileSideMargin: 'comfortable', textAlignment: 'auto' } }) }))
vi.mock('../useReaderChromeVisibility', () => ({ useReaderChromeVisibility: () => { const [visible, setVisible] = useState(true); return { chromeRef: { current: null }, hide: () => setVisible(false), reveal: () => setVisible(true), visible } } }))
vi.mock('./PdfPage', () => ({ PdfPage: (props: { onError: () => void; pageNumber: number }) => { readerMock.pageRenders += 1; return <div className="mock-pdf-page"><span>PDF page {props.pageNumber}</span><button onClick={props.onError} type="button">simulate page error</button><div className="textLayer">text layer</div></div> } }))
vi.mock('../components/ReaderChrome', () => ({ ReaderChrome: (props: { onBack: () => void; onMore: (target: HTMLButtonElement) => void; onSettings: (target: HTMLButtonElement) => void; visible: boolean }) => <header aria-hidden={!props.visible} aria-label="Reader controls"><button aria-label="Back to previous page" onClick={props.onBack} type="button">back</button><button aria-label="PDF view settings" onClick={(event) => props.onSettings(event.currentTarget)} type="button">settings</button><button aria-label="More reader options" onClick={(event) => props.onMore(event.currentTarget)} type="button">more</button></header> }))
vi.mock('../components/AdaptivePanel', () => ({ AdaptivePanel: (props: { children: React.ReactNode; label: string }) => <div aria-label={props.label} className="reader-panel">{props.children}</div> }))

const imported: ImportedDocument = { id: 'pdf-one', format: 'pdf', fileName: 'one.pdf', fileSize: 1, importedAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', metadata: { title: 'Reader test' }, fingerprint: 'one', status: 'ready' }
const sections: DocumentSection[] = [1, 2, 3].map((page) => ({ id: `page-${page}`, order: page - 1, blocks: [{ id: `p-${page}`, type: 'paragraph', text: `Page ${page}`, order: 0 }] }))
const capabilities: DocumentCapabilities = { reflowable: true, supportsOriginalLayout: true, supportsTextSelection: true, supportsSearch: false, supportsTableOfContents: false, supportsPagination: true, supportsReadAloud: false }

describe('PdfDocumentReader', () => {
  let root: Root | undefined
  let container: HTMLDivElement
  let onBack: ReturnType<typeof vi.fn<() => void>>

  beforeEach(() => { readerMock.pdfDocument = {}; readerMock.pageRenders = 0; readerMock.annotations = []; readerMock.updateAnnotation.mockClear(); container = document.createElement('div'); document.body.append(container); onBack = vi.fn<() => void>(); HTMLElement.prototype.scrollIntoView = vi.fn(); HTMLElement.prototype.scrollTo = vi.fn(); window.scrollTo = vi.fn() })
  afterEach(() => { if (root) act(() => root?.unmount()); root = undefined; container.remove(); vi.restoreAllMocks(); vi.clearAllMocks() })
  function mount(isMobile = false, documentCapabilities = capabilities, initialLocation?: ReaderLocation) { root = createRoot(container); act(() => root?.render(<PdfDocumentReader capabilities={documentCapabilities} document={imported} initialLocation={initialLocation} isMobile={isMobile} onBack={onBack} sections={sections} source={new Blob(['pdf'])} />)) }
  function more() { act(() => { container.querySelector<HTMLButtonElement>('[aria-label="More reader options"]')?.click() }) }

  it('shows Retry and Return to Library after a page error, then remounts the page on Retry', () => {
    mount(); expect(container.textContent).toContain('PDF page 1'); const initialRenders = readerMock.pageRenders; act(() => { container.querySelector<HTMLButtonElement>('.mock-pdf-page button')?.click() }); expect(container.textContent).toContain('Retry'); expect(container.textContent).toContain('Return to Library'); act(() => { Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Retry')?.click() }); expect(readerMock.pageRenders).toBe(initialRenders + 1)
  })

  it('returns to the library from the error action and the chrome back button', () => {
    mount(); act(() => { container.querySelector<HTMLButtonElement>('.mock-pdf-page button')?.click() }); act(() => { Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Return to Library')?.click() }); expect(onBack).toHaveBeenCalledTimes(1); act(() => { container.querySelector<HTMLButtonElement>('[aria-label="Back to previous page"]')?.click() }); expect(onBack).toHaveBeenCalledTimes(2)
  })

  it('disables previous and next at the document edges and changes page with the panel', () => {
    mount(); more(); let previous = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Previous page') as HTMLButtonElement; let next = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Next page') as HTMLButtonElement; expect(previous.disabled).toBe(true); expect(next.disabled).toBe(false); act(() => next.click()); expect(container.textContent).toContain('PDF page 2'); act(() => next.click()); expect(container.textContent).toContain('PDF page 3'); more(); previous = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Previous page') as HTMLButtonElement; next = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Next page') as HTMLButtonElement; expect(previous.disabled).toBe(false); expect(next.disabled).toBe(true)
  })

  it('changes page from PageDown and ArrowLeft without moving outside the bounds', () => {
    mount(); act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown' }))); expect(container.textContent).toContain('PDF page 2'); act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }))); expect(container.textContent).toContain('PDF page 1'); act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }))); expect(container.textContent).toContain('PDF page 1')
  })

  it('applies ten rapid Next requests with the functional updater and keeps navigation bounded', () => {
    mount(); const next = container.querySelector<HTMLButtonElement>('[aria-label="Next PDF page"]') as HTMLButtonElement
    act(() => { for (let index = 0; index < 10; index += 1) next.click() })
    expect(container.textContent).toContain('PDF page 3'); expect(next.disabled).toBe(true); expect((container.querySelector('[aria-label="Previous PDF page"]') as HTMLButtonElement).disabled).toBe(false)
  })

  it('does not navigate when keyboard input starts in selectable PDF text', () => {
    mount(); const layer = container.querySelector('.textLayer') as HTMLElement
    act(() => layer.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowRight' })))
    expect(container.textContent).toContain('PDF page 1')
  })

  it('switches between Original Layout and Reading View Beta', () => {
    mount(); more(); expect(container.textContent).toContain('Reading view — Beta'); act(() => { Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Reading view'))?.click() }); expect(container.textContent).toContain('Reading view — Beta'); more(); act(() => { Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Original layout'))?.click() }); expect(container.textContent).toContain('PDF page 1')
  })

  it('keeps scanned PDFs in Original Layout and disables OCR Reading View with the user-facing explanation', () => {
    mount(false, { ...capabilities, reflowable: false, supportsTextSelection: false }); more()
    const readingView = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Reading view')) as HTMLButtonElement
    expect(readingView.disabled).toBe(true); expect(container.textContent).toContain('No selectable text was found. OCR reading view is not available yet.')
  })

  it('keeps PDF Chrome free of TOC and toggles only for stage background clicks', () => {
    mount(true); expect(container.querySelector('[aria-label*="Table of contents"]')).toBeNull(); const stage = container.querySelector('.pdf-reader__stage') as HTMLElement; act(() => stage.click()); expect(container.querySelector('[aria-label="Reader controls"]')?.getAttribute('aria-hidden')).toBe('true'); act(() => stage.click()); expect(container.querySelector('[aria-label="Reader controls"]')?.getAttribute('aria-hidden')).toBe('false'); act(() => container.querySelector('.textLayer')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))); expect(container.querySelector('[aria-label="Reader controls"]')?.getAttribute('aria-hidden')).toBe('false'); more(); const panel = container.querySelector('.reader-panel') as HTMLElement; act(() => panel.click()); expect(container.querySelector('[aria-label="Reader controls"]')?.getAttribute('aria-hidden')).toBe('false')
  })

  it('opens PDF notes from Original Layout in Reading View and restores the prior state', async () => {
    const annotation: ReaderAnnotation = { id: 'note-p1', resourceKey: 'imported:pdf-one', anchorKey: 'old-key', segments: [{ sectionId: 'page-1', sectionIndex: 0, blockId: 'p-1', startOffset: 0, endOffset: 4, exact: 'Page', prefix: '', suffix: ' 1' }], quote: 'Page', color: 'amber', note: 'Saved', createdAt: 1, updatedAt: 1 }
    readerMock.annotations = [annotation]
    const initialLocation: ReaderLocation = { documentId: 'pdf-one', sectionId: 'page-2', sectionIndex: 1, progressPercent: 0, updatedAt: '2026-01-01T00:00:00.000Z', pdf: { mode: 'original', zoomMode: 'custom', zoom: 1.25, rotation: 90, pageNumber: 2 } }
    mount(false, capabilities, initialLocation)
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    const stage = container.querySelector('.pdf-reader__stage') as HTMLElement; stage.scrollTop = 123
    more(); act(() => { Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Highlights & Notes')?.click() })
    act(() => { container.querySelector<HTMLButtonElement>('.highlights-notes__quote')?.click() })
    await act(async () => { await new Promise((resolve) => window.requestAnimationFrame(resolve)) })
    expect(container.querySelector('.reader-article')?.textContent).toContain('Page 1'); expect(container.querySelector('.reader-annotation')).not.toBeNull(); expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalled()
    act(() => { container.querySelector<HTMLButtonElement>('[aria-label="Back to previous page"]')?.click() })
    await act(async () => { await new Promise((resolve) => window.requestAnimationFrame(resolve)) })
    expect(container.querySelector('.pdf-reader__stage')).not.toBeNull(); expect(container.textContent).toContain('PDF page 2'); expect(onBack).not.toHaveBeenCalled()
  })

  it('Escape closes PDF note editing without saving before the next Escape exits', async () => {
    const annotation: ReaderAnnotation = { id: 'note-p1', resourceKey: 'imported:pdf-one', anchorKey: 'key', segments: [{ sectionId: 'page-1', sectionIndex: 0, blockId: 'p-1', startOffset: 0, endOffset: 4, exact: 'Page', prefix: '', suffix: '' }], quote: 'Page', color: 'lavender', note: 'Saved', createdAt: 1, updatedAt: 1 }
    readerMock.annotations = [annotation]; mount()
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    readerMock.updateAnnotation.mockClear()
    more(); act(() => { Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Highlights & Notes')?.click() }); act(() => { Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Edit')?.click() })
    const textarea = container.querySelector('textarea') as HTMLTextAreaElement; expect(textarea.value).toBe('Saved'); act(() => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set?.call(textarea, 'Uncommitted'); textarea.dispatchEvent(new Event('input', { bubbles: true })) })
    await act(async () => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })) })
    expect(container.querySelector('.reader-panel')).toBeNull(); expect(readerMock.updateAnnotation).not.toHaveBeenCalled(); expect(onBack).not.toHaveBeenCalled()
    await act(async () => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); await Promise.resolve() }); expect(onBack).toHaveBeenCalledTimes(1)
  })
})
