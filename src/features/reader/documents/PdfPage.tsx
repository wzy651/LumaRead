import { useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy, PDFPageProxy, RenderTask, TextLayer } from 'pdfjs-dist'
import { pdfScale, rotatedSize, type PdfZoomMode } from './pdfScale'

type Props = { document: PDFDocumentProxy; pageNumber: number; availableSize?: { width: number; height: number }; zoomMode: PdfZoomMode; zoom: number; rotation: number; onScale: (scale: number) => void; onError: () => void; selectable: boolean }
export function PdfPage({ document, pageNumber, availableSize, zoomMode, zoom, rotation, onScale, onError, selectable }: Props) {
  const host = useRef<HTMLDivElement>(null); const canvas = useRef<HTMLCanvasElement>(null); const textLayer = useRef<HTMLDivElement>(null); const generation = useRef(0); const [notice, setNotice] = useState<string>(); const [status, setStatus] = useState<'loading' | 'ready'>('loading')
  useEffect(() => {
    let active = true; let canvasTask: RenderTask | undefined; let layerTask: TextLayer | undefined
    const cancelTasks = () => { canvasTask?.cancel(); layerTask?.cancel(); canvasTask = undefined; layerTask = undefined }
    const current = (request: number) => active && request === generation.current
    const isCancellation = (error: unknown) => error instanceof Error && /cancel|abort/i.test(`${error.name} ${error.message}`)
    const render = async () => {
      cancelTasks()
      const request = ++generation.current
      let page: PDFPageProxy | undefined
      let renderedTask: RenderTask | undefined
      let renderedLayer: TextLayer | undefined
      try {
        page = await document.getPage(pageNumber)
        const target = host.current; const output = canvas.current; const layer = textLayer.current
        if (!current(request) || !target || !output || !layer) return
        layer.replaceChildren(); setNotice(undefined); setStatus('loading'); target.dataset.pageNumber = String(pageNumber); target.dataset.renderState = 'loading'; output.dataset.pageNumber = String(pageNumber); output.width = 0; output.height = 0; output.style.removeProperty('width'); output.style.removeProperty('height')
        const base = page.getViewport({ scale: 1, rotation: 0 }); const scale = pdfScale(zoomMode, availableSize ?? { width: 1, height: 1 }, rotatedSize(base, rotation), zoom); const viewport = page.getViewport({ scale, rotation }); onScale(scale)
        target.style.setProperty('--total-scale-factor', String(viewport.scale)); layer.style.setProperty('--total-scale-factor', String(viewport.scale)); layer.style.setProperty('--min-font-size', '1'); layer.style.setProperty('--text-scale-factor', `calc(${viewport.scale} * var(--min-font-size))`); layer.style.setProperty('--min-font-size-inv', 'calc(1 / var(--min-font-size))'); layer.dataset.pageNumber = String(pageNumber)
        const ratio = Math.min(window.devicePixelRatio || 1, 2); output.width = Math.ceil(viewport.width * ratio); output.height = Math.ceil(viewport.height * ratio); output.style.width = `${viewport.width}px`; output.style.height = `${viewport.height}px`; layer.style.width = `${viewport.width}px`; layer.style.height = `${viewport.height}px`
        const context = output.getContext('2d'); if (!context) throw new Error('canvas')
        context.setTransform(ratio, 0, 0, ratio, 0, 0); renderedTask = page.render({ canvas: output, canvasContext: context, viewport }); canvasTask = renderedTask; await renderedTask.promise
        if (!current(request)) return
        if (!selectable) { target.dataset.renderState = 'ready'; setStatus('ready'); return }
        try {
          const { TextLayer } = await import('pdfjs-dist'); const content = await page.getTextContent()
          if (!current(request)) return
          renderedLayer = new TextLayer({ textContentSource: content, container: layer, viewport }); layerTask = renderedLayer; await renderedLayer.render()
          if (current(request)) { target.dataset.renderState = 'ready'; setStatus('ready') }
        } catch (error) {
          if (current(request) && !isCancellation(error)) { target.dataset.renderState = 'ready'; setNotice('Text selection is unavailable for this page.'); setStatus('ready') }
        }
      } catch (error) { if (current(request) && !isCancellation(error)) { host.current?.setAttribute('data-render-state', 'error'); setStatus('ready'); onError() } }
      finally {
        if (canvasTask === renderedTask) canvasTask = undefined
        if (layerTask === renderedLayer) layerTask = undefined
        page?.cleanup()
      }
    }
    void render()
    const layerNode = textLayer.current
    return () => { active = false; generation.current += 1; cancelTasks(); layerNode?.replaceChildren() }
  }, [availableSize, document, onError, onScale, pageNumber, rotation, selectable, zoom, zoomMode])
  return <div aria-busy={status === 'loading'} className="pdf-page" data-page-number={pageNumber} ref={host}><canvas aria-label={`PDF page ${pageNumber}`} ref={canvas} /><div aria-label="Selectable PDF text" className="pdf-text-layer textLayer" data-page-number={pageNumber} onPointerUp={() => undefined} ref={textLayer} />{status === 'loading' && <span className="pdf-page__loading" role="status">Loading page…</span>}{notice && <p className="pdf-page__notice">{notice}</p>}</div>
}
