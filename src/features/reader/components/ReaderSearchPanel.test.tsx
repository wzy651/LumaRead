// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DocumentSection } from '../../../domain/documents'
import type { ReaderSearchResult } from '../reader-search'
import { ReaderSearchPanel } from './ReaderSearchPanel'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const sections: DocumentSection[] = [{ id: 'chapter-1', title: 'Chapter 1', order: 0, blocks: [{ id: 'p', type: 'paragraph', text: 'needle in the chapter', order: 0 }] }]

describe('ReaderSearchPanel input behavior', () => {
  let root: Root | undefined
  let container: HTMLDivElement
  let onSelect: ReturnType<typeof vi.fn<(result: ReaderSearchResult) => void>>

  beforeEach(() => {
    vi.useFakeTimers()
    container = document.createElement('div')
    document.body.append(container)
    onSelect = vi.fn<(result: ReaderSearchResult) => void>()
    root = createRoot(container)
    act(() => { root?.render(createElement(ReaderSearchPanel, { kind: 'reflowable', onSelect, resourceKey: 'imported:test', sections })) })
  })

  afterEach(() => {
    act(() => root?.unmount())
    root = undefined
    container.remove()
    vi.useRealTimers()
  })

  function composingEvent(type: 'compositionstart' | 'compositionend') {
    act(() => { container.querySelector('input')?.dispatchEvent(new CompositionEvent(type, { bubbles: true })) })
  }

  it('does not submit or close while an IME composition is active, then submits after compositionend', async () => {
    const input = container.querySelector('input') as HTMLInputElement
    const documentEscape = vi.fn()
    document.addEventListener('keydown', documentEscape)
    composingEvent('compositionstart')

    const composingEnter = new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' })
    Object.defineProperty(composingEnter, 'isComposing', { value: true })
    act(() => input.dispatchEvent(composingEnter))
    const composingEscape = new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' })
    Object.defineProperty(composingEscape, 'isComposing', { value: true })
    act(() => input.dispatchEvent(composingEscape))
    expect(onSelect).not.toHaveBeenCalled()
    expect(documentEscape).not.toHaveBeenCalled()

    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    act(() => {
      setter?.call(input, 'needle')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    composingEvent('compositionend')
    await act(async () => { await vi.advanceTimersByTimeAsync(200) })
    const enter = new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' })
    act(() => input.dispatchEvent(enter))
    expect(onSelect).toHaveBeenCalledTimes(1)

    const escape = new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' })
    act(() => input.dispatchEvent(escape))
    expect(documentEscape).toHaveBeenCalledTimes(1)
    document.removeEventListener('keydown', documentEscape)
  })
})
