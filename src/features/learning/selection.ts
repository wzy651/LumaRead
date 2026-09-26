import type { ReadingExcerpt } from './types'

export type ExcerptSource = Pick<ReadingExcerpt, 'resourceKey' | 'bookTitle' | 'sectionId' | 'pageNumber'>
export interface LocatedExcerpt { excerpt: ReadingExcerpt; anchor: HTMLElement; rect: DOMRect }
const allowed = '[data-reader-block-id], .reader-prose p, .pdf-text-layer span, .reader-sentence-target'
const excluded = 'a, input, textarea, select, [contenteditable="true"], [data-annotation-id], .reader-panel, .selection-toolbar, .reader-chrome, .reader-page-navigation'

export function sentenceAround(text: string, start: number, end: number): string {
  if (typeof Intl.Segmenter === 'function') {
    const segmenter = new Intl.Segmenter('en', { granularity: 'sentence' })
    for (const segment of segmenter.segment(text)) {
      if (segment.index <= start && start < segment.index + segment.segment.length && end <= segment.index + segment.segment.length) {
        if (segment.segment.length <= 1600) return segment.segment.trim()
        break
      }
    }
  }
  return text.slice(Math.max(0, start - 400), Math.min(text.length, Math.max(end, start + 600))).trim().slice(0, 1600)
}
export function wordAtOffset(text: string, offset: number): { text: string; start: number; end: number } | undefined {
  const words = text.matchAll(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g)
  for (const match of words) {
    if (match.index <= offset && offset <= match.index + match[0].length) return { text: match[0], start: match.index, end: match.index + match[0].length }
    if (match.index > offset) break
  }
}
// PDF text items may be split into one span per word. Reading a single span is
// not enough context, and textContent alone silently joins adjacent words.
export function contextAtAnchor(anchor: HTMLElement, start: number, end: number): string {
  const layer = anchor.closest('.pdf-text-layer')
  if (!layer) return sentenceAround(anchor.textContent ?? '', start, end)
  const spans = Array.from(layer.querySelectorAll<HTMLElement>('span')).filter((span) => !span.querySelector('span'))
  const index = spans.indexOf(anchor)
  if (index < 0) return sentenceAround(anchor.textContent ?? '', start, end)
  const before = spans.slice(Math.max(0, index - 24), index).map((span) => span.textContent ?? '').join(' ')
  const after = spans.slice(index, index + 25).map((span) => span.textContent ?? '').join(' ')
  const prefix = before ? `${before} ` : ''
  return sentenceAround(prefix + after, prefix.length + start, prefix.length + end)
}
export function excerptFromSelection(root: HTMLElement, source: ExcerptSource): LocatedExcerpt | undefined {
  const selection = window.getSelection()
  if (!selection || selection.isCollapsed || !selection.rangeCount) return
  const range = selection.getRangeAt(0)
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return
  const element = range.startContainer instanceof Element ? range.startContainer : range.startContainer.parentElement
  const anchor = element?.closest<HTMLElement>(allowed)
  if (!anchor || element?.closest('.reader-panel, .selection-toolbar')) return
  const text = selection.toString().trim()
  if (!text || text.length > 600) return
  let sentence = text
  if (anchor.contains(range.endContainer)) {
    const before = range.cloneRange(); before.selectNodeContents(anchor); before.setEnd(range.startContainer, range.startOffset)
    const start = before.toString().length
    sentence = contextAtAnchor(anchor, start, start + text.length)
  }
  return { anchor, rect: range.getBoundingClientRect(), excerpt: { ...source, text, sentence, blockId: anchor.dataset.readerBlockId } }
}
export function excerptAtPoint(root: HTMLElement, event: MouseEvent, source: ExcerptSource): LocatedExcerpt | undefined {
  const target = event.target instanceof Element ? event.target : undefined
  if (!target || target.closest(excluded) || (target.closest('button') && !target.closest('.reader-word, .reader-sentence-target'))) return
  const anchor = target.closest<HTMLElement>(allowed)
  if (!anchor || !root.contains(anchor)) return
  const caretDocument = document as Document & { caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null; caretRangeFromPoint?: (x: number, y: number) => Range | null }
  const caret = caretDocument.caretPositionFromPoint?.(event.clientX, event.clientY)
  const legacy = !caret ? caretDocument.caretRangeFromPoint?.(event.clientX, event.clientY) : undefined
  const node = caret?.offsetNode ?? legacy?.startContainer, offset = caret?.offset ?? legacy?.startOffset
  if (!node || node.nodeType !== Node.TEXT_NODE || offset === undefined || !anchor.contains(node)) return
  const word = wordAtOffset(node.textContent ?? '', offset)
  if (!word) return
  const range = document.createRange(); range.setStart(node, word.start); range.setEnd(node, word.end)
  const inside = Array.from(range.getClientRects()).some((rect) => event.clientX >= rect.left - 1 && event.clientX <= rect.right + 1 && event.clientY >= rect.top && event.clientY <= rect.bottom)
  if (!inside) return
  const before = document.createRange(); before.selectNodeContents(anchor); before.setEnd(node, word.start)
  const start = before.toString().length
  return { anchor, rect: range.getBoundingClientRect(), excerpt: { ...source, text: word.text, sentence: contextAtAnchor(anchor, start, start + word.text.length), blockId: anchor.dataset.readerBlockId } }
}
