import { useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy, RenderTask, TextLayer } from 'pdfjs-dist'
import { pdfScale, rotatedSize, type PdfZoomMode } from './pdfScale'

type Props = { document: PDFDocumentProxy; pageNumber: number; zoomMode: PdfZoomMode; zoom: number; rotation: number; onScale: (scale: number) => void; onError: () => void; selectable: boolean }
export function PdfPage({ document, pageNumber, zoomMode, zoom, rotation, onScale, onError, selectable }: Props) {
  const host = useRef<HTMLDivElement>(null); const canvas = useRef<HTMLCanvasElement>(null); const textLayer = useRef<HTMLDivElement>(null); const task = useRef<RenderTask | undefined>(undefined); const textTask = useRef<TextLayer | undefined>(undefined); const generation = useRef(0); const [notice, setNotice] = useState<string>()
  useEffect(() => {
    let active = true; const request = ++generation.current; let pageCleanup: (() => void) | undefined
    const render = async () => {
      try {
        const page = await document.getPage(pageNumber); pageCleanup = () => page.cleanup(); const target = host.current; const output = canvas.current; const layer = textLayer.current
        if (!active || request !== generation.current || !target || !output || !layer) return
        task.current?.cancel(); textTask.current?.cancel(); layer.replaceChildren(); setNotice(undefined)
        const base = page.getViewport({ scale: 1, rotation: 0 }); const scale = pdfScale(zoomMode, { width: target.clientWidth, height: target.clientHeight }, rotatedSize(base, rotation), zoom); const viewport = page.getViewport({ scale, rotation }); onScale(scale)
        const ratio = Math.min(window.devicePixelRatio || 1, 2); output.width = Math.ceil(viewport.width * ratio); output.height = Math.ceil(viewport.height * ratio); output.style.width = `${viewport.width}px`; output.style.height = `${viewport.height}px`; layer.style.width = `${viewport.width}px`; layer.style.height = `${viewport.height}px`
        const context = output.getContext('2d'); if (!context) throw new Error('canvas')
        context.setTransform(ratio, 0, 0, ratio, 0, 0); const renderTask = page.render({ canvas: output, canvasContext: context, viewport }); task.current = renderTask; await renderTask.promise
        if (!active || request !== generation.current || !selectable) return
        try { const { TextLayer } = await import('pdfjs-dist'); const content = await page.getTextContent(); if (!active || request !== generation.current) return; const officialLayer = new TextLayer({ textContentSource: content, container: layer, viewport }); textTask.current = officialLayer; await officialLayer.render() } catch { if (active && request === generation.current) setNotice('Text selection is unavailable for this page.') }
      } catch (error) { if (active && request === generation.current && !(error instanceof Error && /cancel/i.test(error.name))) onError() }
    }
    void render(); const observer = new ResizeObserver(() => { if (zoomMode !== 'actual' && zoomMode !== 'custom') void render() }); if (host.current) observer.observe(host.current)
    const layerNode = textLayer.current
    return () => { active = false; generation.current += 1; task.current?.cancel(); textTask.current?.cancel(); layerNode?.replaceChildren(); observer.disconnect(); pageCleanup?.() }
  }, [document, onError, onScale, pageNumber, rotation, selectable, zoom, zoomMode])
  return <div className="pdf-page" ref={host}><canvas aria-label={`PDF page ${pageNumber}`} ref={canvas} /><div aria-label="Selectable PDF text" className="pdf-text-layer textLayer" onPointerUp={() => undefined} ref={textLayer} />{notice && <p className="pdf-page__notice">{notice}</p>}</div>
}
