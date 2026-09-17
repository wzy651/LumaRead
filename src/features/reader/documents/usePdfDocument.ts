import { useEffect, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'

export function usePdfDocument(source: Blob) {
  const [document, setDocument] = useState<PDFDocumentProxy>()
  const [error, setError] = useState<string>()
  useEffect(() => {
    let active = true
    let loadingTask: { destroy: () => Promise<void> } | undefined
    let loaded: PDFDocumentProxy | undefined
    void (async () => {
      try {
        const pdfjs = await import('pdfjs-dist')
        const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
        pdfjs.GlobalWorkerOptions.workerSrc = worker.default
        const task = pdfjs.getDocument({ data: new Uint8Array(await source.arrayBuffer()), disableAutoFetch: true, disableRange: true, isEvalSupported: false })
        loadingTask = task
        const result = await task.promise; loaded = result
        if (!active) { await result.destroy(); return }
        setDocument(result)
      } catch { if (active) setError('LumaRead could not open this PDF.') }
    })()
    return () => { active = false; void (loaded?.destroy() ?? loadingTask?.destroy()) }
  }, [source])
  return { document, error }
}
