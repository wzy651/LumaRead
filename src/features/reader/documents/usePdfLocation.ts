import { useCallback, useEffect, useRef } from 'react'
import type { ImportedDocument, ReaderLocation } from '../../../domain/documents'
import { getDocumentRepository, getReadingActivityRepository } from '../../../storage'
import type { PdfZoomMode } from './pdfScale'
export type PdfLocationState = { page: number; mode: 'original' | 'reading'; zoomMode: PdfZoomMode; zoom: number; rotation: number }
export function usePdfLocation(document: ImportedDocument, total: number, state: PdfLocationState) {
  const latest = useRef(state); const latestDocument = useRef({ id: document.id, total }); const timer = useRef<number | undefined>(undefined); const pending = useRef(true)
  const save = useCallback(() => { if (!pending.current) return; pending.current = false; const current = latest.current; const target = latestDocument.current; const now = new Date().toISOString(); const location: ReaderLocation = { documentId: target.id, sectionId: `page-${current.page}`, sectionIndex: current.page - 1, progressPercent: 0, updatedAt: now, pdf: { mode: current.mode, zoomMode: current.zoomMode, zoom: current.zoom, rotation: current.rotation, pageNumber: current.page } }; void Promise.resolve().then(() => getDocumentRepository().saveLocation(location)).catch(() => undefined); void Promise.resolve().then(() => getReadingActivityRepository().recordProgress({ contentKind: 'imported', documentId: target.id, sectionId: location.sectionId, sectionIndex: location.sectionIndex, locationLabel: `Page ${current.page} of ${target.total}`, lastReadAt: now })).catch(() => undefined) }, [])
  useEffect(() => { latest.current = state; latestDocument.current = { id: document.id, total }; pending.current = true; window.clearTimeout(timer.current); timer.current = window.setTimeout(save, 500); return () => window.clearTimeout(timer.current) }, [document.id, save, state, total])
  useEffect(() => () => { window.clearTimeout(timer.current); save() }, [save])
}
