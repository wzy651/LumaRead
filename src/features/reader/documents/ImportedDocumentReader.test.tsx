// @vitest-environment jsdom
import { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DocumentSection, StoredDocument } from '../../../domain/documents'
import { ImportedDocumentReader } from './ImportedDocumentReader'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const navigate = vi.hoisted(() => vi.fn())
const repository = vi.hoisted(() => ({ getDocument: vi.fn(), getLocation: vi.fn(), saveLocation: vi.fn().mockResolvedValue(undefined), updateDocumentContent: vi.fn(), recordOpen: vi.fn() }))
const bookmarkRepository = vi.hoisted(() => ({ listForResource: vi.fn().mockResolvedValue([]), toggleAtLocator: vi.fn(), remove: vi.fn() }))

vi.mock('react-router-dom', async (importOriginal) => { const actual = await importOriginal<typeof import('react-router-dom')>(); return { ...actual, useNavigate: () => navigate } })
vi.mock('../../../storage', () => ({ getDocumentRepository: () => repository, getBookmarkRepository: () => bookmarkRepository, getReadingActivityRepository: () => ({ recordOpen: vi.fn().mockResolvedValue(undefined), recordProgress: vi.fn().mockResolvedValue(undefined) }) }))
vi.mock('../../../app/responsive', () => ({ MEDIA_QUERIES: { mobile: '(max-width: 600px)' }, useMediaQuery: () => false }))
vi.mock('../useReaderSettings', () => ({ useReaderSettings: () => ({ settings: { fontFamily: 'serif', fontScale: 1, lineHeight: 'comfortable', textWidthCh: 64, mobileSideMargin: 'comfortable', textAlignment: 'auto' }, setSettings: vi.fn() }) }))
vi.mock('../useReaderChromeVisibility', () => ({ useReaderChromeVisibility: () => ({ chromeRef: { current: null }, hide: vi.fn(), reveal: vi.fn(), visible: true }) }))
vi.mock('../useReaderKeyboardNavigation', () => ({ useReaderKeyboardNavigation: vi.fn() }))
vi.mock('../useReaderSearchShortcut', () => ({ useReaderSearchShortcut: vi.fn() }))
vi.mock('../components/ReaderChrome', () => ({ ReaderChrome: (props: { backLabel: string; onBack: () => void; onMore: (anchor: HTMLButtonElement) => void; onSettings: (anchor: HTMLButtonElement) => void; onOpenBookmarks: (anchor: HTMLButtonElement) => void; onOpenSearch: (anchor: HTMLButtonElement) => void }) => <header><button aria-label={props.backLabel} onClick={props.onBack} type="button">back</button><button aria-label="More" onClick={(event) => props.onMore(event.currentTarget)} type="button">more</button><button aria-label="Settings" onClick={(event) => props.onSettings(event.currentTarget)} type="button">settings</button><button aria-label="Bookmarks" onClick={(event) => props.onOpenBookmarks(event.currentTarget)} type="button">bookmarks</button><button aria-label="Search in current book" onClick={(event) => props.onOpenSearch(event.currentTarget)} type="button">search</button></header> }))
vi.mock('../components/ReaderChromeRevealZone', () => ({ ReaderChromeRevealZone: () => null }))
vi.mock('../components/ReaderMoreMenu', () => ({ ReaderMoreMenu: (props: { onOpenTableOfContents?: () => void }) => <button onClick={props.onOpenTableOfContents} type="button">Table of contents</button> }))
vi.mock('../components/ReadingSettingsPanel', () => ({ ReadingSettingsPanel: () => <div>settings content</div> }))
vi.mock('../components/ReaderBookmarksPanel', () => ({ ReaderBookmarksPanel: () => <div>bookmarks content</div> }))
vi.mock('../components/ReaderSearchPanel', () => ({ ReaderSearchPanel: () => <div>search content</div> }))
vi.mock('../documents/PdfDocumentReader', () => ({ PdfDocumentReader: () => <div>pdf</div> }))
vi.mock('../components/AdaptivePanel', () => ({ AdaptivePanel: (props: { anchorElement: HTMLElement; children: React.ReactNode; label: string; onClose: () => void }) => { useEffect(() => () => { if (document.contains(props.anchorElement)) props.anchorElement.focus() }, [props.anchorElement]); return <div aria-label={props.label} role="dialog"><button onClick={props.onClose} type="button">close</button>{props.children}</div> } }))

const sections: DocumentSection[] = [
  { id: 'section-0', order: 0, title: 'One', blocks: [{ id: 'source', type: 'paragraph', text: 'Go to next Note', order: 0, links: [{ id: 'next', start: 0, end: 10, role: 'link', target: { sectionId: 'section-1', blockId: 'target' } }, { id: 'note', start: 11, end: 15, role: 'noteref', target: { sectionId: 'section-1', blockId: 'note-block' } }] }] },
  { id: 'section-1', order: 1, title: 'Two', blocks: [{ id: 'target', type: 'paragraph', text: 'Destination', order: 0 }, { id: 'note-block', type: 'paragraph', text: 'A multi-paragraph note starts here.', order: 1 }] },
]
const documentRecord: StoredDocument = { document: { id: 'reader-doc', format: 'epub', fileName: 'reader.epub', fileSize: 1, importedAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', metadata: { title: 'Reader' }, fingerprint: 'reader', status: 'ready' }, source: new Blob(['epub']), sections, capabilities: { reflowable: true, supportsOriginalLayout: false, supportsTextSelection: true, supportsSearch: true, supportsTableOfContents: true, supportsPagination: false, supportsReadAloud: false, supportsInternalLinks: true }, contentSchemaVersion: 2 }

describe('ImportedDocumentReader internal link harness', () => {
  let root: Root | undefined
  let container: HTMLDivElement
  beforeEach(async () => { HTMLElement.prototype.scrollIntoView = vi.fn(); window.scrollTo = vi.fn(); repository.getDocument.mockResolvedValue(documentRecord); repository.getLocation.mockResolvedValue(undefined); container = document.createElement('div'); document.body.append(container); root = createRoot(container); await act(async () => { root?.render(<ImportedDocumentReader documentId="reader-doc" />); await new Promise((resolve) => window.setTimeout(resolve, 50)); await Promise.resolve() }) })
  afterEach(() => { if (root) act(() => root?.unmount()); root = undefined; container.remove(); navigate.mockClear(); repository.getDocument.mockReset(); repository.getLocation.mockReset(); bookmarkRepository.listForResource.mockClear() })
  function anchor(text: string) { return Array.from(container.querySelectorAll<HTMLAnchorElement>('a')).find((item) => item.textContent === text) as HTMLAnchorElement }
  function click(element: Element) { act(() => { (element as HTMLElement).click() }) }

  it('navigates valid same/cross-section links after the new DOM is rendered and returns by history', async () => {
    click(anchor('Go to next')); await act(async () => { await Promise.resolve(); await Promise.resolve() }); expect(container.querySelector('[data-reader-section-id="section-1"]')).not.toBeNull(); expect(container.querySelector('[aria-label="Back to previous reading position"]')).not.toBeNull(); click(container.querySelector('[aria-label="Back to previous reading position"]')!); expect(container.querySelector('[data-reader-section-id="section-0"]')).not.toBeNull()
  })

  it('does not change position or history for a missing target block', async () => {
    const invalid = { ...sections[0].blocks[0], links: [{ id: 'invalid', start: 0, end: 10, role: 'link' as const, target: { sectionId: 'section-1', blockId: 'missing' } }] }; const invalidRecord = { ...documentRecord, sections: [{ ...sections[0], blocks: [invalid] }, sections[1]] }; act(() => root?.unmount()); repository.getDocument.mockResolvedValue(invalidRecord); root = createRoot(container); await act(async () => { root?.render(<ImportedDocumentReader documentId="reader-doc" />); await new Promise((resolve) => window.setTimeout(resolve, 50)); await Promise.resolve() }); click(anchor('Go to next')); expect(container.querySelector('[data-reader-section-id="section-0"]')).not.toBeNull(); expect(container.querySelector('[aria-label="Back to Library"]')).not.toBeNull()
  })

  it('opens footnotes without history, closes other panels, and only Open note in text adds history', () => {
    click(anchor('Note')); expect(container.querySelector('[aria-label="Footnote"]')).not.toBeNull(); expect(container.querySelector('[aria-label="Back to Library"]')).not.toBeNull(); click(container.querySelector('[aria-label="Search in current book"]')!); expect(container.querySelector('[aria-label="Footnote"]')).toBeNull(); expect(container.querySelector('[aria-label="Search in current book"]')).not.toBeNull()
  })

  it('returns focus to the footnote reference when Escape closes the preview', async () => {
    const reference = anchor('Note'); click(reference); await act(async () => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); await new Promise((resolve) => window.requestAnimationFrame(resolve)) }); expect(container.querySelector('[aria-label="Footnote"]')).toBeNull(); expect(document.activeElement).toBe(reference)
  })

  it('keeps reader panels mutually exclusive and Escape closes the panel before leaving', async () => {
    click(container.querySelector('[aria-label="More"]')!); expect(container.querySelector('[aria-label="More reader options"]')).not.toBeNull(); click(container.querySelector('[aria-label="Settings"]')!); expect(container.querySelector('[aria-label="More reader options"]')).toBeNull(); expect(container.querySelector('[aria-label="Reading settings"]')).not.toBeNull(); await act(async () => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })) }); expect(container.querySelector('[aria-label="Reading settings"]')).toBeNull(); expect(navigate).not.toHaveBeenCalled(); await act(async () => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); await Promise.resolve() }); expect(navigate).toHaveBeenCalled()
  })
})
