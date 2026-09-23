// @vitest-environment jsdom
import { act, type MouseEvent as ReactMouseEvent } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DocumentBlock, DocumentInternalLink } from '../../../domain/documents'
import type { ReaderAnnotation } from '../../../domain/annotation'
import { DocumentBlockRenderer } from './DocumentBlockRenderer'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const block: DocumentBlock = { id: 'linked', type: 'paragraph', text: '😀 Read note twice', order: 0, links: [{ id: 'one', start: 3, end: 7, role: 'noteref', target: { sectionId: 'section-1', blockId: 'block-2' } }, { id: 'two', start: 13, end: 18, role: 'link', target: { sectionId: 'section-2' } }] }

describe('DocumentBlockRenderer DOM interactions', () => {
  let root: Root | undefined
  let container: HTMLDivElement
  let onInternalLink: ReturnType<typeof vi.fn<(link: DocumentInternalLink, anchor: HTMLAnchorElement) => void>>
  let outerClick: ReturnType<typeof vi.fn<(event: ReactMouseEvent<HTMLDivElement>) => void>>

  beforeEach(() => { container = document.createElement('div'); document.body.append(container); onInternalLink = vi.fn(); outerClick = vi.fn(); root = createRoot(container); act(() => root?.render(<div onClick={outerClick}><DocumentBlockRenderer blocks={[block]} onInternalLink={onInternalLink} /></div>)) })
  afterEach(() => { if (root) act(() => root?.unmount()); root = undefined; container.remove() })

  it('preserves UTF-16 emoji offsets and dispatches a real click without bubbling', () => {
    const anchors = container.querySelectorAll<HTMLAnchorElement>('a'); expect(anchors[0].textContent).toBe('Read'); expect(anchors[1].textContent).toBe('twice');
    const event = new MouseEvent('click', { bubbles: true, cancelable: true }); act(() => anchors[0].dispatchEvent(event)); expect(event.defaultPrevented).toBe(true); expect(onInternalLink).toHaveBeenCalledTimes(1); expect(onInternalLink.mock.calls[0][0].id).toBe('one'); expect(outerClick).not.toHaveBeenCalled()
  })

  it('stops Enter propagation while leaving the native keyboard activation available', () => {
    const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Enter' }); act(() => { container.querySelector<HTMLAnchorElement>('a')?.dispatchEvent(event) }); expect(event.defaultPrevented).toBe(false); expect(outerClick).not.toHaveBeenCalled()
  })

  it('keeps an internal link activatable inside a highlight and opens highlighted text by keyboard', () => {
    const annotation: ReaderAnnotation = { id: 'a', resourceKey: 'imported:book', anchorKey: 'key', segments: [{ sectionId: 'section-1', sectionIndex: 0, blockId: 'linked', blockOrder: 0, startOffset: 3, endOffset: 7, exact: 'Read', prefix: '😀 ', suffix: ' note twice' }], quote: 'Read', color: 'amber', createdAt: 1, updatedAt: 1 }
    const plainAnnotation: ReaderAnnotation = { ...annotation, id: 'plain', segments: [{ ...annotation.segments[0], startOffset: 8, endOffset: 12, exact: 'note' }], quote: 'note' }
    const onAnnotationClick = vi.fn()
    act(() => root?.render(<DocumentBlockRenderer annotations={[annotation, plainAnnotation]} blocks={[block]} onAnnotationClick={onAnnotationClick} onInternalLink={onInternalLink} sectionId="section-1" />))
    const mark = container.querySelector('mark')!; expect(mark.querySelector('a')?.textContent).toBe('Read')
    const click = new MouseEvent('click', { bubbles: true, cancelable: true }); act(() => mark.querySelector('a')?.dispatchEvent(click)); expect(onInternalLink).toHaveBeenCalledTimes(1); expect(onAnnotationClick).not.toHaveBeenCalled()
    const keyboardMark = container.querySelector<HTMLElement>('[data-annotation-id="plain"]')!; const keyboard = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Enter' }); act(() => keyboardMark.dispatchEvent(keyboard)); expect(keyboard.defaultPrevented).toBe(true); expect(onAnnotationClick).toHaveBeenCalledTimes(1)
  })

  it('ignores invalid and out-of-range annotation offsets', () => {
    const annotation: ReaderAnnotation = { id: 'bad', resourceKey: 'imported:book', anchorKey: 'key', segments: [{ sectionId: 'section-1', sectionIndex: 0, blockId: 'linked', startOffset: 18, endOffset: 19, exact: 'x', prefix: '', suffix: '' }], quote: 'x', color: 'lavender', createdAt: 1, updatedAt: 1 }
    act(() => root?.render(<DocumentBlockRenderer annotations={[annotation]} blocks={[block]} sectionId="section-1" />)); expect(container.querySelector('mark')).toBeNull(); expect(container.textContent).toBe(block.text)
  })

  it('renders malformed, overlapping, or missing-target ranges as plain text', () => {
    const unsafe: DocumentBlock = { id: 'unsafe', type: 'paragraph', text: 'One two', order: 0, links: [{ id: 'missing', start: 0, end: 3, role: 'link', target: { sectionId: '' } }] }; act(() => root?.render(<DocumentBlockRenderer blocks={[unsafe]} onInternalLink={onInternalLink} />)); expect(container.querySelector('a')).toBeNull(); expect(container.textContent).toBe('One two')
  })
})
