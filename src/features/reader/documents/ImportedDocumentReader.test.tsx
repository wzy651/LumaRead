// @vitest-environment jsdom
import { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DocumentSection, StoredDocument } from '../../../domain/documents'
import type { ReaderSearchResult } from '../reader-search'
import { ImportedDocumentReader } from './ImportedDocumentReader'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const navigate = vi.hoisted(() => vi.fn())
const repository = vi.hoisted(() => ({ getDocument: vi.fn(), getLocation: vi.fn(), saveLocation: vi.fn().mockResolvedValue(undefined), updateDocumentContent: vi.fn(), recordOpen: vi.fn() }))
const bookmarkRepository = vi.hoisted(() => ({ listForResource: vi.fn().mockResolvedValue([]), toggleAtLocator: vi.fn(), remove: vi.fn() }))

vi.mock('react-router-dom', async (importOriginal) => { const actual = await importOriginal<typeof import('react-router-dom')>(); return { ...actual, useNavigate: () => navigate } })
vi.mock('../../../storage', () => ({ getDocumentRepository: () => repository, getBookmarkRepository: () => bookmarkRepository, getReadingActivityRepository: () => ({ recordOpen: vi.fn().mockResolvedValue(undefined), recordProgress: vi.fn().mockResolvedValue(undefined) }) }))
vi.mock('../../../app/responsive', () => ({ MEDIA_QUERIES: { mobile: '(max-width: 600px)' }, useMediaQuery: () => false }))
const readerSettingsFixture = vi.hoisted(() => ({ initialMode: 'scroll' as 'scroll' | 'pages' }))
vi.mock('../useReaderSettings', async () => { const { useState } = await import('react'); return { useReaderSettings: () => { const [settings, setSettings] = useState({ fontFamily: 'serif' as const, fontScale: 1, lineHeight: 'comfortable' as const, textWidthCh: 64, mobileSideMargin: 'comfortable' as const, textAlignment: 'auto' as const, epubReadingMode: readerSettingsFixture.initialMode }); return { settings, setSettings } } } })
vi.mock('../useReaderChromeVisibility', () => ({ useReaderChromeVisibility: () => ({ chromeRef: { current: null }, hide: vi.fn(), reveal: vi.fn(), visible: true }) }))
vi.mock('../useReaderKeyboardNavigation', () => ({ useReaderKeyboardNavigation: vi.fn() }))
vi.mock('../useReaderSearchShortcut', () => ({ useReaderSearchShortcut: vi.fn() }))
vi.mock('../components/ReaderChrome', () => ({ ReaderChrome: (props: { backLabel: string; onBack: () => void; onMore: (anchor: HTMLButtonElement) => void; onSettings: (anchor: HTMLButtonElement) => void; onOpenBookmarks: (anchor: HTMLButtonElement) => void; onOpenSearch: (anchor: HTMLButtonElement) => void }) => <header><button aria-label={props.backLabel} onClick={props.onBack} type="button">back</button><button aria-label="More" onClick={(event) => props.onMore(event.currentTarget)} type="button">more</button><button aria-label="Settings" onClick={(event) => props.onSettings(event.currentTarget)} type="button">settings</button><button aria-label="Bookmarks" onClick={(event) => props.onOpenBookmarks(event.currentTarget)} type="button">bookmarks</button><button aria-label="Search in current book" onClick={(event) => props.onOpenSearch(event.currentTarget)} type="button">search</button></header> }))
vi.mock('../components/ReaderChromeRevealZone', () => ({ ReaderChromeRevealZone: () => null }))
vi.mock('../components/ReaderMoreMenu', () => ({ ReaderMoreMenu: (props: { onOpenTableOfContents?: () => void }) => <button onClick={props.onOpenTableOfContents} type="button">Table of contents</button> }))
vi.mock('../components/ReadingSettingsPanel', () => ({ ReadingSettingsPanel: (props: { setSettings: (action: (current: { epubReadingMode: 'scroll' | 'pages' }) => { epubReadingMode: 'scroll' | 'pages' }) => void }) => <button onClick={() => props.setSettings((current) => ({ ...current, epubReadingMode: 'pages' }))} type="button">Pages</button> }))
vi.mock('../components/ReaderBookmarksPanel', () => ({ ReaderBookmarksPanel: () => <div>bookmarks content</div> }))
vi.mock('../components/ReaderSearchPanel', () => ({ ReaderSearchPanel: (props: { onSelect: (result: ReaderSearchResult) => void }) => <button onClick={() => props.onSelect({ id: 'result', resourceKey: 'imported:reader-doc', locator: { version: 1, kind: 'reflowable', resourceKey: 'imported:reader-doc', sectionId: 'section-1', sectionIndex: 1, blockId: 'target' }, sectionLabel: 'Two', excerpt: 'Destination', matchStart: 0, matchEnd: 4, excerptMatchStart: 0, excerptMatchEnd: 4, blockText: 'Destination' })} type="button">Open search result</button> }))
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
  beforeEach(async () => { readerSettingsFixture.initialMode = 'scroll'; HTMLElement.prototype.scrollIntoView = vi.fn(); window.scrollTo = vi.fn(); window.matchMedia = vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }); Object.defineProperties(HTMLElement.prototype, { clientWidth: { configurable: true, get() { return this.classList?.contains('reader-article--pages') ? 300 : 0 } }, scrollWidth: { configurable: true, get() { return this.classList?.contains('reader-article--pages') ? (this.dataset.readerSectionId === 'section-1' ? 300 : 1200) : 0 } }, scrollTo: { configurable: true, value: vi.fn(function (this: HTMLElement, options: ScrollToOptions) { this.scrollLeft = options.left ?? 0; this.dispatchEvent(new Event('scroll')) }) } }); globalThis.ResizeObserver = class { observe() {} disconnect() {} } as unknown as typeof ResizeObserver; repository.getDocument.mockResolvedValue(documentRecord); repository.getLocation.mockResolvedValue(undefined); repository.saveLocation.mockResolvedValue(undefined); container = document.createElement('div'); document.body.append(container); root = createRoot(container); await act(async () => { root?.render(<ImportedDocumentReader documentId="reader-doc" />); await new Promise((resolve) => window.setTimeout(resolve, 50)); await Promise.resolve() }) })
  afterEach(() => { if (root) act(() => root?.unmount()); root = undefined; container.remove(); navigate.mockClear(); repository.getDocument.mockReset(); repository.getLocation.mockReset(); bookmarkRepository.listForResource.mockClear(); readerSettingsFixture.initialMode = 'scroll' })
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

  it('opens settings, switches to Pages, and keeps the new page instead of restoring the old locator', async () => {
    click(container.querySelector('[aria-label="Settings"]')!); click(container.querySelector('[role="dialog"] button:last-child')!); await act(async () => { await new Promise((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve))) })
    const navigation = container.querySelector('[aria-label="Page navigation"]')!; expect(navigation.textContent).toContain('1 / 4')
    const scrollTo = vi.mocked(HTMLElement.prototype.scrollTo); const callsBeforeTurn = scrollTo.mock.calls.length
    click(container.querySelector('[aria-label="Next page"]')!); expect(navigation.textContent).toContain('2 / 4'); expect(container.querySelector('article')?.scrollLeft).toBe(300); expect(scrollTo.mock.calls.length - callsBeforeTurn).toBe(1)
  })

  it('clears a canceled swipe so the later pointer-up cannot change chapters', () => {
    const main = container.querySelector('main')!
    const pointer = (type: string, x: number) => { const event = new Event(type, { bubbles: true }); Object.defineProperties(event, { pointerType: { value: 'touch' }, clientX: { value: x }, clientY: { value: 120 }, isPrimary: { value: true } }); return event }
    act(() => { main.dispatchEvent(pointer('pointerdown', 240)); main.dispatchEvent(pointer('pointercancel', 240)); main.dispatchEvent(pointer('pointerup', 120)) })
    expect(container.querySelector('article')?.getAttribute('data-reader-section-id')).toBe('section-0')
  })

  it('turns one page for a deliberate single-finger horizontal swipe only once', async () => {
    click(container.querySelector('[aria-label="Settings"]')!); click(container.querySelector('[role="dialog"] button:last-child')!); await act(async () => { await new Promise((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve))) })
    const main = container.querySelector('main')!
    const pointer = (type: string, x: number, y: number, isPrimary = true) => { const event = new Event(type, { bubbles: true }); Object.defineProperties(event, { pointerType: { value: 'touch' }, clientX: { value: x }, clientY: { value: y }, isPrimary: { value: isPrimary } }); return event }
    act(() => { main.dispatchEvent(pointer('pointerdown', 240, 120)); main.dispatchEvent(pointer('pointerup', 140, 126)); main.dispatchEvent(pointer('pointerup', 140, 126)) })
    expect(container.querySelector('[aria-label="Page navigation"]')?.textContent).toContain('2 / 4')
    act(() => { main.dispatchEvent(pointer('pointerdown', 240, 120, false)); main.dispatchEvent(pointer('pointerup', 140, 126)); main.dispatchEvent(pointer('pointerdown', 12, 120)); main.dispatchEvent(pointer('pointerup', 112, 126)); main.dispatchEvent(pointer('pointerdown', 240, 120)); main.dispatchEvent(pointer('pointerup', 225, 220)) })
    expect(container.querySelector('[aria-label="Page navigation"]')?.textContent).toContain('2 / 4')
  })

  it('keeps a fast sequence of discrete direction keys in order', async () => {
    click(container.querySelector('[aria-label="Settings"]')!); click(container.querySelector('[role="dialog"] button:last-child')!); click(container.querySelector('[role="dialog"] button:first-child')!); await act(async () => { await new Promise((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve))) })
    const article = container.querySelector('article')!
    act(() => { for (let index = 0; index < 3; index += 1) article.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true })) })
    expect(container.querySelector('[aria-label="Page navigation"]')?.textContent).toContain('4 / 4'); expect(container.querySelector('article')?.scrollLeft).toBe(900)
  })

  it('navigates a search result to the visible chapter and returns to the prior locator', async () => {
    click(container.querySelector('[aria-label="Settings"]')!); click(container.querySelector('[role="dialog"] button:last-child')!); click(container.querySelector('[role="dialog"] button:first-child')!); await act(async () => { await new Promise((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve))) })
    click(container.querySelector('[aria-label="Search in current book"]')!); click(container.querySelector('[role="dialog"] button:last-child')!)
    await act(async () => { await new Promise((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve))) })
    expect(container.querySelector('article')?.getAttribute('data-reader-section-id')).toBe('section-1'); expect(container.querySelector('[aria-label="Page navigation"]')?.textContent).toContain('1 / 1')
    click(container.querySelector('[aria-label="Back to previous reading position"]')!)
    await act(async () => { await new Promise((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve))) })
    expect(container.querySelector('article')?.getAttribute('data-reader-section-id')).toBe('section-0'); expect(container.querySelector('[aria-label="Page navigation"]')?.textContent).toContain('1 / 4')
  })

  it('crosses chapter edges in both directions and stops at the document ends', async () => {
    click(container.querySelector('[aria-label="Settings"]')!); click(container.querySelector('[role="dialog"] button:last-child')!); await act(async () => { await new Promise((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve))) })
    const turn = (name: string) => click(container.querySelector(`[aria-label="${name} page"]`)!)
    const flushLayout = () => act(async () => { await new Promise((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve))) })
    expect(container.querySelector('[aria-label="Page navigation"]')?.textContent).toContain('1 / 4')
    for (let i = 0; i < 3; i += 1) turn('Next')
    expect(container.querySelector('[aria-label="Page navigation"]')?.textContent).toContain('4 / 4')
    turn('Next'); await flushLayout()
    expect(container.querySelector('article')?.getAttribute('data-reader-section-id')).toBe('section-1'); expect(container.querySelector('[aria-label="Page navigation"]')?.textContent).toContain('1 / 1'); expect((container.querySelector('[aria-label="Page navigation"] button[aria-label="Next page"]') as HTMLButtonElement).disabled).toBe(true)
    turn('Previous'); await flushLayout()
    expect(container.querySelector('article')?.getAttribute('data-reader-section-id')).toBe('section-0'); expect(container.querySelector('[aria-label="Page navigation"]')?.textContent).toContain('4 / 4')
    turn('Previous'); turn('Previous'); turn('Previous')
    expect((container.querySelector('[aria-label="Page navigation"] button[aria-label="Previous page"]') as HTMLButtonElement).disabled).toBe(true)
  })

  it('waits for the latest location write before returning to the library', async () => {
    let finish!: () => void
    const saving = new Promise<void>((resolve) => { finish = resolve })
    repository.saveLocation.mockReturnValue(saving)
    await act(async () => { (container.querySelector('[aria-label="Back to Library"]') as HTMLButtonElement).click(); await Promise.resolve() })
    expect(navigate).not.toHaveBeenCalled()
    await act(async () => { finish(); await saving; await Promise.resolve() })
    expect(navigate).toHaveBeenCalledWith('/library')
  })

})
