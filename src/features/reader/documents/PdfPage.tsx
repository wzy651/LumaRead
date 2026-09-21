import { useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy, PDFPageProxy, RenderTask, TextLayer } from 'pdfjs-dist'
import { pdfScale, rotatedSize, type PdfZoomMode } from './pdfScale'

type Props = { document: PDFDocumentProxy; pageNumber: number; zoomMode: PdfZoomMode; zoom: number; rotation: number; onScale: (scale: number) => void; onError: () => void; selectable: boolean }
export function PdfPage({ document, pageNumber, zoomMode, zoom, rotation, onScale, onError, selectable }: Props) {
  const host = useRef<HTMLDivElement>(null); const canvas = useRef<HTMLCanvasElement>(null); const textLayer = useRef<HTMLDivElement>(null); const generation = useRef(0); const [notice, setNotice] = useState<string>()
  useEffect(() => {
    let active = true; let frame = 0; let canvasTask: RenderTask | undefined; let layerTask: TextLayer | undefined
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
        layer.replaceChildren(); setNotice(undefined)
        const base = page.getViewport({ scale: 1, rotation: 0 }); const scale = pdfScale(zoomMode, { width: target.clientWidth, height: target.clientHeight }, rotatedSize(base, rotation), zoom); const viewport = page.getViewport({ scale, rotation }); onScale(scale)
        const ratio = Math.min(window.devicePixelRatio || 1, 2); output.width = Math.ceil(viewport.width * ratio); output.height = Math.ceil(viewport.height * ratio); output.style.width = `${viewport.width}px`; output.style.height = `${viewport.height}px`; layer.style.width = `${viewport.width}px`; layer.style.height = `${viewport.height}px`
        const context = output.getContext('2d'); if (!context) throw new Error('canvas')
        context.setTransform(ratio, 0, 0, ratio, 0, 0); renderedTask = page.render({ canvas: output, canvasContext: context, viewport }); canvasTask = renderedTask; await renderedTask.promise
        if (!current(request) || !selectable) return
        try {
          const { TextLayer } = await import('pdfjs-dist'); const content = await page.getTextContent()
          if (!current(request)) return
          renderedLayer = new TextLayer({ textContentSource: content, container: layer, viewport }); layerTask = renderedLayer; await renderedLayer.render()
        } catch (error) {
          if (current(request) && !isCancellation(error)) setNotice('Text selection is unavailable for this page.')
        }
      } catch (error) { if (current(request) && !isCancellation(error)) onError() }
      finally {
        if (canvasTask === renderedTask) canvasTask = undefined
        if (layerTask === renderedLayer) layerTask = undefined
        page?.cleanup()
      }
    }
    void render(); const observer = new ResizeObserver(() => { if (zoomMode === 'actual' || zoomMode === 'custom' || frame) return; frame = requestAnimationFrame(() => { frame = 0; void render() }) }); if (host.current) observer.observe(host.current)
    const layerNode = textLayer.current
    return () => { active = false; generation.current += 1; if (frame) cancelAnimationFrame(frame); cancelTasks(); layerNode?.replaceChildren(); observer.disconnect() }
  }, [document, onError, onScale, pageNumber, rotation, selectable, zoom, zoomMode])
  return <div className="pdf-page" ref={host}><canvas aria-label={`PDF page ${pageNumber}`} ref={canvas} /><div aria-label="Selectable PDF text" className="pdf-text-layer textLayer" onPointerUp={() => undefined} ref={textLayer} />{notice && <p className="pdf-page__notice">{notice}</p>}</div>
}
