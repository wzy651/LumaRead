// @vitest-environment jsdom
import { act, type MouseEvent as ReactMouseEvent } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DocumentBlock, DocumentInternalLink } from '../../../domain/documents'
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

  it('renders malformed, overlapping, or missing-target ranges as plain text', () => {
    const unsafe: DocumentBlock = { id: 'unsafe', type: 'paragraph', text: 'One two', order: 0, links: [{ id: 'missing', start: 0, end: 3, role: 'link', target: { sectionId: '' } }] }; act(() => root?.render(<DocumentBlockRenderer blocks={[unsafe]} onInternalLink={onInternalLink} />)); expect(container.querySelector('a')).toBeNull(); expect(container.textContent).toBe('One two')
  })
})
