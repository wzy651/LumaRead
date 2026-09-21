// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ImportedDocument } from '../../../domain/documents'
import { usePdfLocation, type PdfLocationState } from './usePdfLocation'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const storageMock = vi.hoisted(() => ({ getDocumentRepository: vi.fn(), getReadingActivityRepository: vi.fn() }))
vi.mock('../../../storage', () => storageMock)

const documentOne: ImportedDocument = { id: 'pdf-one', format: 'pdf', fileName: 'one.pdf', fileSize: 10, importedAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', metadata: { title: 'One' }, fingerprint: 'one', status: 'ready' }
const documentTwo = { ...documentOne, id: 'pdf-two', fingerprint: 'two' }
const initialState: PdfLocationState = { page: 2, mode: 'original', zoomMode: 'custom', zoom: 1.25, rotation: 90 }

describe('usePdfLocation', () => {
  let root: Root | undefined
  let container: HTMLDivElement
  const saveLocation = vi.fn<(location: Record<string, unknown>) => Promise<void>>(() => Promise.resolve())
  const recordProgress = vi.fn<(activity: Record<string, unknown>) => Promise<void>>(() => Promise.resolve())

  function Harness({ document, total, state }: { document: ImportedDocument; total: number; state: PdfLocationState }) { usePdfLocation(document, total, state); return null }
  function mount(document = documentOne, total = 8, state = initialState) { root = createRoot(container); act(() => root?.render(createElement(Harness, { document, total, state }))) }
  function rerender(document: ImportedDocument, total: number, state: PdfLocationState) { act(() => root?.render(createElement(Harness, { document, total, state }))) }
  async function settle() { await act(async () => { await Promise.resolve(); await Promise.resolve() }) }

  beforeEach(() => {
    vi.useFakeTimers(); container = document.createElement('div'); document.body.append(container); saveLocation.mockReset(); recordProgress.mockReset(); saveLocation.mockResolvedValue(undefined); recordProgress.mockResolvedValue(undefined)
    storageMock.getDocumentRepository.mockReturnValue({ saveLocation }); storageMock.getReadingActivityRepository.mockReturnValue({ recordProgress })
  })
  afterEach(() => { vi.runOnlyPendingTimers(); vi.useRealTimers(); if (root) act(() => root?.unmount()); root = undefined; vi.clearAllMocks(); container.remove() })

  it('does not write before 500ms and writes once at 500ms', async () => {
    mount(); act(() => { vi.advanceTimersByTime(499) }); expect(saveLocation).not.toHaveBeenCalled(); expect(recordProgress).not.toHaveBeenCalled(); act(() => { vi.advanceTimersByTime(1) }); await settle(); expect(saveLocation).toHaveBeenCalledTimes(1); expect(recordProgress).toHaveBeenCalledTimes(1)
  })

  it('coalesces state changes and saves the final PDF location', async () => {
    mount(); rerender(documentOne, 8, { ...initialState, page: 3 }); rerender(documentOne, 8, { ...initialState, page: 4, mode: 'reading' }); act(() => { vi.advanceTimersByTime(500) }); await settle()
    expect(saveLocation).toHaveBeenCalledWith(expect.objectContaining({ documentId: 'pdf-one', sectionId: 'page-4', sectionIndex: 3, pdf: { pageNumber: 4, mode: 'reading', zoomMode: 'custom', zoom: 1.25, rotation: 90 } })); expect(recordProgress).toHaveBeenCalledWith(expect.objectContaining({ documentId: 'pdf-one', sectionId: 'page-4', sectionIndex: 3, locationLabel: 'Page 4 of 8' }))
  })

  it('saves an uncommitted final state on unmount', async () => {
    mount(documentOne, 5, { ...initialState, page: 5 }); act(() => root?.unmount()); root = undefined; await settle(); expect(saveLocation).toHaveBeenCalledWith(expect.objectContaining({ documentId: 'pdf-one', sectionId: 'page-5' })); expect(recordProgress).toHaveBeenCalledTimes(1)
  })

  it('does not duplicate an already committed state during unmount', async () => {
    mount(); act(() => { vi.advanceTimersByTime(500) }); await settle(); act(() => root?.unmount()); root = undefined; expect(saveLocation).toHaveBeenCalledTimes(1); expect(recordProgress).toHaveBeenCalledTimes(1)
  })

  it('does not write a previous document state into a new document', async () => {
    mount(documentOne, 8, { ...initialState, page: 7 }); rerender(documentTwo, 3, { ...initialState, page: 1 }); act(() => { vi.advanceTimersByTime(500) }); await settle()
    expect(saveLocation).toHaveBeenCalledTimes(1); expect(saveLocation.mock.calls[0][0]).toMatchObject({ documentId: 'pdf-two', sectionId: 'page-1' }); expect(recordProgress.mock.calls[0][0]).toMatchObject({ documentId: 'pdf-two', locationLabel: 'Page 1 of 3' })
  })

  it('swallows document and activity repository rejections', async () => {
    saveLocation.mockRejectedValue(new Error('document failed')); recordProgress.mockRejectedValue(new Error('activity failed')); mount(); act(() => { vi.advanceTimersByTime(500) }); await settle(); expect(saveLocation).toHaveBeenCalledTimes(1); expect(recordProgress).toHaveBeenCalledTimes(1)
  })
})
