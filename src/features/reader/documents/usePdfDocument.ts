import { useEffect, useRef, useState } from 'react'
import { GlobalWorkerOptions, getDocument, type PDFDocumentProxy } from 'pdfjs-dist'
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

export function usePdfDocument(source: Blob) {
  const [result, setResult] = useState<{ source: Blob; document?: PDFDocumentProxy; error?: string }>()
  const generation = useRef(0)
  useEffect(() => {
    const request = ++generation.current
    let active = true
    let loadingTask: { destroy: () => Promise<void> } | undefined
    let loaded: PDFDocumentProxy | undefined
    let loadingDestroyed = false
    let documentDestroyed = false
    const isCurrent = () => active && request === generation.current
    const destroyLoadingTask = async () => { if (loadingTask && !loadingDestroyed) { loadingDestroyed = true; try { await loadingTask.destroy() } catch { /* Cancellation is expected during cleanup. */ } } }
    const destroyDocument = async (value: PDFDocumentProxy) => { if (!documentDestroyed) { documentDestroyed = true; try { await value.destroy() } catch { /* Cleanup must not create an unhandled rejection. */ } } }
    void (async () => {
      try {
        GlobalWorkerOptions.workerSrc = workerSrc
        const task = getDocument({ data: new Uint8Array(await source.arrayBuffer()), disableAutoFetch: true, disableRange: true, isEvalSupported: false })
        loadingTask = task
        const result = await task.promise; loaded = result
        if (!isCurrent()) { await destroyDocument(result); return }
        setResult({ source, document: result })
      } catch { if (isCurrent()) setResult({ source, error: 'LumaRead could not open this PDF.' }) }
    })()
    return () => { active = false; generation.current += 1; if (loaded) void destroyDocument(loaded); else void destroyLoadingTask() }
  }, [source])
  const current = result?.source === source ? result : undefined
  return { document: current?.document, error: current?.error }
}
