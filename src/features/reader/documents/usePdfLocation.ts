import { useCallback, useEffect, useRef } from 'react'
import type { ImportedDocument, ReaderLocation } from '../../../domain/documents'
import { getDocumentRepository, getReadingActivityRepository } from '../../../storage'
import type { PdfZoomMode } from './pdfScale'
export type PdfLocationState = { page: number; mode: 'original' | 'reading'; zoomMode: PdfZoomMode; zoom: number; rotation: number }
export function usePdfLocation(document: ImportedDocument, total: number, state: PdfLocationState) {
  const latest = useRef(state); const timer = useRef<number | undefined>(undefined); const pending = useRef(true)
  const save = useCallback(() => { if (!pending.current) return; pending.current = false; const current = latest.current; const now = new Date().toISOString(); const location: ReaderLocation = { documentId: document.id, sectionId: `page-${current.page}`, sectionIndex: current.page - 1, progressPercent: 0, updatedAt: now, pdf: { mode: current.mode, zoomMode: current.zoomMode, zoom: current.zoom, rotation: current.rotation, pageNumber: current.page } }; void getDocumentRepository().saveLocation(location).catch(() => undefined); void getReadingActivityRepository().recordProgress({ contentKind: 'imported', documentId: document.id, sectionId: location.sectionId, sectionIndex: location.sectionIndex, locationLabel: `Page ${current.page} of ${total}`, lastReadAt: now }).catch(() => undefined) }, [document.id, total])
  useEffect(() => { latest.current = state; pending.current = true; window.clearTimeout(timer.current); timer.current = window.setTimeout(save, 500); return () => window.clearTimeout(timer.current) }, [save, state])
  useEffect(() => () => { window.clearTimeout(timer.current); save() }, [save])
}
