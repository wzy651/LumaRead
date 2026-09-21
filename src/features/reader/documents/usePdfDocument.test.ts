// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { usePdfDocument } from './usePdfDocument'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const pdfMock = vi.hoisted(() => ({
  getDocument: vi.fn(),
  GlobalWorkerOptions: { workerSrc: '' },
}))
vi.mock('pdfjs-dist', () => ({ getDocument: (...args: unknown[]) => pdfMock.getDocument(...args), GlobalWorkerOptions: pdfMock.GlobalWorkerOptions }))
vi.mock('pdfjs-dist/build/pdf.worker.min.mjs?url', () => ({ default: '/assets/pdf.worker.min.mjs' }))

type Deferred<T> = { promise: Promise<T>; resolve: (value: T) => void; reject: (error: unknown) => void }
function deferred<T>(): Deferred<T> { let resolve!: (value: T) => void; let reject!: (error: unknown) => void; const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej }); return { promise, resolve, reject } }
function pdfDocument(destroy = vi.fn<() => Promise<void>>(() => Promise.resolve())) { return { destroy, numPages: 1 } as unknown as PDFDocumentProxy }
function loadingTask(result: Promise<PDFDocumentProxy>, destroy = vi.fn<() => Promise<void>>(() => Promise.resolve())) { return { promise: result, destroy } }
function source(value: string): Blob { const blob = new Blob([value]); Object.defineProperty(blob, 'arrayBuffer', { value: async () => new TextEncoder().encode(value).buffer }); return blob }

describe('usePdfDocument', () => {
  let root: Root | undefined
  let container: HTMLDivElement
  let latest: { document?: PDFDocumentProxy; error?: string } = {}

  function Harness({ source }: { source: Blob }) { latest = usePdfDocument(source); return createElement('output', null, latest.error ?? (latest.document ? 'loaded' : 'loading')) }
  function mount(source: Blob) { root = createRoot(container); act(() => root?.render(createElement(Harness, { source }))) }
  function rerender(source: Blob) { act(() => root?.render(createElement(Harness, { source }))) }
  async function flush() { await act(async () => { await new Promise<void>((resolve) => setTimeout(resolve, 0)); for (let index = 0; index < 6; index += 1) await Promise.resolve() }) }

  beforeEach(() => { container = document.createElement('div'); document.body.append(container); latest = {}; pdfMock.getDocument.mockReset(); pdfMock.GlobalWorkerOptions.workerSrc = '' })
  afterEach(() => { if (root) act(() => root?.unmount()); root = undefined; vi.clearAllMocks(); container.remove() })

  it('loads a local Blob and configures the bundled worker URL', async () => {
    const documentProxy = pdfDocument(); pdfMock.getDocument.mockReturnValue(loadingTask(Promise.resolve(documentProxy)))
    mount(source('pdf')); await flush()
    expect(pdfMock.getDocument).toHaveBeenCalledWith(expect.objectContaining({ data: expect.any(Uint8Array), disableAutoFetch: true, disableRange: true, isEvalSupported: false }))
    expect(pdfMock.GlobalWorkerOptions.workerSrc).toBe('/assets/pdf.worker.min.mjs'); expect(latest.document).toBe(documentProxy)
    act(() => root?.unmount()); root = undefined; expect(documentProxy.destroy).toHaveBeenCalledTimes(1)
  })

  it('turns a failed load into a friendly error', async () => {
    const load = deferred<PDFDocumentProxy>(); pdfMock.getDocument.mockReturnValue(loadingTask(load.promise)); mount(source('bad')); await flush(); load.reject(new Error('invalid pdf')); await flush()
    expect(latest.error).toBe('LumaRead could not open this PDF.')
  })

  it('does not allow a stale source to replace the newer document', async () => {
    const oldLoad = deferred<PDFDocumentProxy>(); const newLoad = deferred<PDFDocumentProxy>(); const oldDocument = pdfDocument(); const newDocument = pdfDocument(); const oldTask = loadingTask(oldLoad.promise); const newTask = loadingTask(newLoad.promise)
    pdfMock.getDocument.mockReturnValueOnce(oldTask).mockReturnValueOnce(newTask); const first = source('one'); mount(first); await flush(); rerender(source('two')); await flush()
    newLoad.resolve(newDocument); await flush(); oldLoad.resolve(oldDocument); await flush()
    expect(latest.document).toBe(newDocument); expect(oldDocument.destroy).toHaveBeenCalledTimes(1); expect(oldTask.destroy).toHaveBeenCalledTimes(1); expect(newDocument.destroy).not.toHaveBeenCalled()
  })

  it('destroys a loading task when unmounted while loading', async () => {
    const load = deferred<PDFDocumentProxy>(); const destroy = vi.fn<() => Promise<void>>(() => Promise.resolve()); pdfMock.getDocument.mockReturnValue(loadingTask(load.promise, destroy)); mount(source('pdf')); await flush(); act(() => root?.unmount()); root = undefined
    expect(destroy).toHaveBeenCalledTimes(1); load.resolve(pdfDocument()); await flush()
  })

  it('destroys a loaded document exactly once on unmount', async () => {
    const destroy = vi.fn<() => Promise<void>>(() => Promise.resolve()); const documentProxy = pdfDocument(destroy); pdfMock.getDocument.mockReturnValue(loadingTask(Promise.resolve(documentProxy))); mount(source('pdf')); await flush(); act(() => root?.unmount()); root = undefined; expect(destroy).toHaveBeenCalledTimes(1)
  })

  it('catches loading-task destroy rejection during cleanup', async () => {
    const destroy = vi.fn<() => Promise<void>>(() => Promise.reject(new Error('destroy failed'))); pdfMock.getDocument.mockReturnValue(loadingTask(new Promise<PDFDocumentProxy>(() => undefined), destroy)); mount(source('pdf')); await flush(); act(() => root?.unmount()); root = undefined; await flush(); expect(destroy).toHaveBeenCalledTimes(1)
  })

  it('catches document destroy rejection during cleanup', async () => {
    const destroy = vi.fn<() => Promise<void>>(() => Promise.reject(new Error('destroy failed'))); const documentProxy = pdfDocument(destroy); pdfMock.getDocument.mockReturnValue(loadingTask(Promise.resolve(documentProxy))); mount(source('pdf')); await flush(); act(() => root?.unmount()); root = undefined; await flush(); expect(destroy).toHaveBeenCalledTimes(1)
  })
})
