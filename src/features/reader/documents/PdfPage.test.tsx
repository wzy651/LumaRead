// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PDFDocumentProxy, PDFPageProxy, RenderTask, TextLayer } from 'pdfjs-dist'
import { PdfPage } from './PdfPage'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const pdfMock = vi.hoisted(() => ({
  textLayers: [] as TextLayer[],
  textLayerRender: vi.fn<() => Promise<void>>(() => Promise.resolve()),
}))

vi.mock('pdfjs-dist', () => ({
  TextLayer: class {
    constructor(options: unknown) { Object.assign(this, options); pdfMock.textLayers.push(this as unknown as TextLayer) }
    render() { return pdfMock.textLayerRender() }
  },
}))

type Deferred<T> = { promise: Promise<T>; resolve: (value: T) => void; reject: (error: unknown) => void }
function deferred<T>(): Deferred<T> { let resolve!: (value: T) => void; let reject!: (error: unknown) => void; const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej }); return { promise, resolve, reject } }
function pageWith(renderTask: RenderTask, cleanup = vi.fn(), viewport = { width: 600, height: 800 }): PDFPageProxy {
  return { cleanup, getViewport: vi.fn(({ scale, rotation }: { scale: number; rotation: number }) => ({ ...viewport, width: viewport.width * scale, height: viewport.height * scale, scale, rotation } as ReturnType<PDFPageProxy['getViewport']>)), render: vi.fn(() => renderTask), getTextContent: vi.fn(async () => ({ items: [] })) } as unknown as PDFPageProxy
}
function renderTask(promise: Promise<void>): RenderTask & { cancel: ReturnType<typeof vi.fn> } { let rejectCancel!: (error: unknown) => void; const cancelled = new Promise<void>((_, reject) => { rejectCancel = reject }); const cancel = vi.fn(() => rejectCancel(Object.assign(new Error('cancelled'), { name: 'AbortError' }))); return { promise: Promise.race([promise, cancelled]), cancel } as unknown as RenderTask & { cancel: ReturnType<typeof vi.fn> } }

describe('PdfPage', () => {
  let root: Root | undefined
  let container: HTMLDivElement
  let canvasContext: CanvasRenderingContext2D

  beforeEach(() => {
    container = document.createElement('div'); document.body.append(container)
    canvasContext = { setTransform: vi.fn() } as unknown as CanvasRenderingContext2D
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(canvasContext)
    pdfMock.textLayers.length = 0; pdfMock.textLayerRender.mockReset(); pdfMock.textLayerRender.mockResolvedValue(undefined)
  })

  afterEach(() => { if (root) act(() => root?.unmount()); root = undefined; vi.restoreAllMocks(); container.remove() })

  function renderPage(documentProxy: PDFDocumentProxy, props: Partial<React.ComponentProps<typeof PdfPage>> = {}) {
    root?.render(<PdfPage availableSize={props.availableSize ?? { width: 900, height: 700 }} document={documentProxy} onError={props.onError ?? vi.fn()} onScale={props.onScale ?? vi.fn()} pageNumber={props.pageNumber ?? 1} rotation={props.rotation ?? 0} selectable={props.selectable ?? true} zoom={props.zoom ?? 1} zoomMode={props.zoomMode ?? 'comfortable'} />)
  }
  function mount(documentProxy: PDFDocumentProxy, props: Partial<React.ComponentProps<typeof PdfPage>> = {}) { root = createRoot(container); act(() => renderPage(documentProxy, props)) }

  it('mounts a page, uses the supplied stage size, and cleans up when selection is disabled', async () => {
    const task = renderTask(Promise.resolve()); const cleanup = vi.fn(); const page = pageWith(task, cleanup); const onScale = vi.fn()
    const proxy = { getPage: vi.fn(async () => page) } as unknown as PDFDocumentProxy
    await act(async () => mount(proxy, { selectable: false, onScale, availableSize: { width: 720, height: 640 } }))
    expect(proxy.getPage).toHaveBeenCalledWith(1); expect(page.render).toHaveBeenCalled(); expect(onScale).toHaveBeenCalledWith(1.2); expect(cleanup).toHaveBeenCalledTimes(1); expect(pdfMock.textLayers).toHaveLength(0)
  })

  it('sets the same viewport scale on canvas sizing and the official TextLayer root', async () => {
    const task = renderTask(Promise.resolve()); const page = pageWith(task); const onScale = vi.fn(); const proxy = { getPage: vi.fn(async () => page) } as unknown as PDFDocumentProxy
    await act(async () => mount(proxy, { onScale, zoomMode: 'custom', zoom: 1.25 }))
    const layer = container.querySelector('.pdf-text-layer') as HTMLElement
    expect(page.render).toHaveBeenCalledWith(expect.objectContaining({ viewport: expect.objectContaining({ scale: 1.25 }) }))
    expect(onScale).toHaveBeenCalledWith(1.25); expect(layer.style.getPropertyValue('--total-scale-factor')).toBe('1.25'); expect(layer.style.getPropertyValue('--min-font-size')).toBe('1'); expect(layer.style.getPropertyValue('--text-scale-factor')).toContain('var(--min-font-size)'); expect(layer.style.getPropertyValue('--min-font-size-inv')).toContain('var(--min-font-size)'); expect(pdfMock.textLayers[0]).toMatchObject({ viewport: expect.objectContaining({ scale: 1.25 }) })
    const canvas = container.querySelector('canvas') as HTMLElement; expect(canvas.dataset.pageNumber).toBe('1'); expect(canvas.compareDocumentPosition(layer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('keeps the canvas and shows a notice when the official text layer rejects', async () => {
    pdfMock.textLayerRender.mockRejectedValue(new Error('text failed'))
    const cleanup = vi.fn(); const page = pageWith(renderTask(Promise.resolve()), cleanup); const proxy = { getPage: vi.fn(async () => page) } as unknown as PDFDocumentProxy
    await act(async () => mount(proxy))
    expect(container.querySelector('canvas')).not.toBeNull(); expect(container.textContent).toContain('Text selection is unavailable'); expect(cleanup).toHaveBeenCalledTimes(1)
  })

  it('cancels stale page work when the parent requests a new page', async () => {
    const first = deferred<PDFPageProxy>(); const second = deferred<PDFPageProxy>(); const firstCleanup = vi.fn(); const secondCleanup = vi.fn(); const onScale = vi.fn(); const onError = vi.fn()
    const proxy = { getPage: vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise) } as unknown as PDFDocumentProxy
    mount(proxy, { onScale, onError }); await act(async () => { await Promise.resolve() })
    act(() => renderPage(proxy, { pageNumber: 2, onScale, onError }))
    const secondPage = pageWith(renderTask(Promise.resolve()), secondCleanup); second.resolve(secondPage); await act(async () => { await Promise.resolve() })
    const firstPage = pageWith(renderTask(Promise.resolve()), firstCleanup); first.resolve(firstPage); await act(async () => { await Promise.resolve() })
    expect(onScale).toHaveBeenCalledTimes(1); expect(firstCleanup).toHaveBeenCalledTimes(1); expect(secondCleanup).toHaveBeenCalledTimes(1); expect(onError).not.toHaveBeenCalled(); expect(container.querySelector('.pdf-page')?.getAttribute('data-page-number')).toBe('2')
  })

  it('cancels active canvas work and cleans it up on unmount', async () => {
    const task = renderTask(new Promise<void>(() => undefined)); const cleanup = vi.fn(); const page = pageWith(task, cleanup); const proxy = { getPage: vi.fn(async () => page) } as unknown as PDFDocumentProxy
    mount(proxy); await act(async () => { await Promise.resolve() }); act(() => root?.unmount()); root = undefined; await act(async () => { await Promise.resolve() })
    expect(task.cancel).toHaveBeenCalledTimes(1); expect(cleanup).toHaveBeenCalledTimes(1)
  })
})
