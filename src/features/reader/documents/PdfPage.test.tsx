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
function pageWith(renderTask: RenderTask, cleanup = vi.fn()): PDFPageProxy {
  const viewport = { width: 600, height: 800 } as ReturnType<PDFPageProxy['getViewport']>
  return { cleanup, getViewport: vi.fn(() => viewport), render: vi.fn(() => renderTask), getTextContent: vi.fn(async () => ({ items: [] })) } as unknown as PDFPageProxy
}
function renderTask(promise: Promise<void>): RenderTask & { cancel: ReturnType<typeof vi.fn> } { let rejectCancel!: (error: unknown) => void; const cancelled = new Promise<void>((_, reject) => { rejectCancel = reject }); const cancel = vi.fn(() => rejectCancel(Object.assign(new Error('cancelled'), { name: 'AbortError' }))); return { promise: Promise.race([promise, cancelled]), cancel } as unknown as RenderTask & { cancel: ReturnType<typeof vi.fn> } }

describe('PdfPage', () => {
  let root: Root | undefined
  let container: HTMLDivElement
  let resizeCallbacks: Array<() => void>
  let rafCallbacks: Array<FrameRequestCallback>
  let canvasContext: CanvasRenderingContext2D

  beforeEach(() => {
    container = document.createElement('div'); document.body.append(container)
    resizeCallbacks = []; rafCallbacks = []
    canvasContext = { setTransform: vi.fn() } as unknown as CanvasRenderingContext2D
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(canvasContext)
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} constructor(callback: () => void) { resizeCallbacks.push(callback) } })
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { rafCallbacks.push(callback); return rafCallbacks.length })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    pdfMock.textLayers.length = 0; pdfMock.textLayerRender.mockReset(); pdfMock.textLayerRender.mockResolvedValue(undefined)
  })

  afterEach(() => { if (root) act(() => root?.unmount()); root = undefined; vi.restoreAllMocks(); vi.unstubAllGlobals(); container.remove() })

  function mount(documentProxy: PDFDocumentProxy, props: Partial<React.ComponentProps<typeof PdfPage>> = {}) {
    root = createRoot(container)
    act(() => root?.render(<PdfPage document={documentProxy} onError={props.onError ?? vi.fn()} onScale={props.onScale ?? vi.fn()} pageNumber={1} rotation={0} selectable={props.selectable ?? true} zoom={1} zoomMode={props.zoomMode ?? 'comfortable'} />))
  }

  it('mounts a page and cleans it up even when text selection is disabled', async () => {
    const task = renderTask(Promise.resolve()); const cleanup = vi.fn(); const page = pageWith(task, cleanup)
    const proxy = { getPage: vi.fn(async () => page) } as unknown as PDFDocumentProxy
    await act(async () => mount(proxy, { selectable: false }))
    expect(proxy.getPage).toHaveBeenCalledWith(1); expect(page.render).toHaveBeenCalled(); expect(cleanup).toHaveBeenCalledTimes(1)
  })

  it('cleans up and reports a missing canvas context', async () => {
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(null)
    const cleanup = vi.fn(); const page = pageWith(renderTask(Promise.resolve()), cleanup); const onError = vi.fn()
    const proxy = { getPage: vi.fn(async () => page) } as unknown as PDFDocumentProxy
    await act(async () => mount(proxy, { onError }))
    expect(cleanup).toHaveBeenCalledTimes(1); expect(onError).toHaveBeenCalledTimes(1)
  })

  it('cleans up when canvas rendering rejects', async () => {
    const task = renderTask(Promise.reject(new Error('render failed'))); const cleanup = vi.fn(); const page = pageWith(task, cleanup); const onError = vi.fn()
    const proxy = { getPage: vi.fn(async () => page) } as unknown as PDFDocumentProxy
    await act(async () => mount(proxy, { onError }))
    expect(task.cancel).not.toHaveBeenCalled(); expect(cleanup).toHaveBeenCalledTimes(1); expect(onError).toHaveBeenCalledTimes(1)
  })

  it('keeps the canvas and shows a notice when the official text layer rejects', async () => {
    pdfMock.textLayerRender.mockRejectedValue(new Error('text failed'))
    const cleanup = vi.fn(); const page = pageWith(renderTask(Promise.resolve()), cleanup); const proxy = { getPage: vi.fn(async () => page) } as unknown as PDFDocumentProxy
    await act(async () => mount(proxy))
    expect(container.querySelector('canvas')).not.toBeNull(); expect(container.textContent).toContain('Text selection is unavailable'); expect(cleanup).toHaveBeenCalledTimes(1)
  })

  it('does not let a stale page result update the current render', async () => {
    const first = deferred<PDFPageProxy>(); const second = deferred<PDFPageProxy>(); const firstCleanup = vi.fn(); const secondCleanup = vi.fn(); const onScale = vi.fn(); const onError = vi.fn()
    const proxy = { getPage: vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise) } as unknown as PDFDocumentProxy
    mount(proxy, { onScale, onError });
    await act(async () => { resizeCallbacks[0]?.(); rafCallbacks.shift()?.(0); await Promise.resolve() })
    const secondPage = pageWith(renderTask(Promise.resolve()), secondCleanup); second.resolve(secondPage)
    await act(async () => { await Promise.resolve() })
    const firstPage = pageWith(renderTask(Promise.resolve()), firstCleanup); first.resolve(firstPage)
    await act(async () => { await Promise.resolve() })
    expect(onScale).toHaveBeenCalledTimes(1); expect(firstCleanup).toHaveBeenCalledTimes(1); expect(secondCleanup).toHaveBeenCalledTimes(1); expect(onError).not.toHaveBeenCalled()
  })

  it('coalesces resize events into one render and cancels the previous canvas task', async () => {
    const firstTask = renderTask(new Promise<void>(() => undefined)); const firstPage = pageWith(firstTask, vi.fn())
    const secondPage = pageWith(renderTask(Promise.resolve()), vi.fn()); const proxy = { getPage: vi.fn().mockResolvedValueOnce(firstPage).mockResolvedValueOnce(secondPage) } as unknown as PDFDocumentProxy
    mount(proxy); await act(async () => { await Promise.resolve() })
    resizeCallbacks[0]?.(); resizeCallbacks[0]?.()
    await act(async () => { rafCallbacks.shift()?.(0); await Promise.resolve() })
    expect(firstTask.cancel).toHaveBeenCalledTimes(1); expect(proxy.getPage).toHaveBeenCalledTimes(2)
  })

  it('cancels active work and cleans up exactly once on unmount', async () => {
    const task = renderTask(new Promise<void>(() => undefined)); const cleanup = vi.fn(); const page = pageWith(task, cleanup); const proxy = { getPage: vi.fn(async () => page) } as unknown as PDFDocumentProxy
    mount(proxy); await act(async () => { await Promise.resolve() }); act(() => root?.unmount()); root = undefined; await act(async () => { await Promise.resolve() })
    expect(task.cancel).toHaveBeenCalledTimes(1); expect(cleanup).toHaveBeenCalledTimes(1)
  })
})
