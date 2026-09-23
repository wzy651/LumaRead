// @vitest-environment jsdom
import { act } from 'react'
import { describe, expect, it } from 'vitest'
import type { DocumentSection } from '../../domain/documents'
import { createTextAnchorFromSelection, recoverAnnotation } from './annotation-anchor'

const sections: DocumentSection[] = [{ id: 'chapter-1', order: 0, blocks: [{ id: 'one', type: 'paragraph', text: '😀 First block.', order: 0 }, { id: 'two', type: 'paragraph', text: 'Second block with a link.', order: 1 }] }, { id: 'chapter-2', order: 1, blocks: [{ id: 'three', type: 'paragraph', text: 'Another chapter.', order: 0 }] }]

function selectionIn(node: Node, start: number, end: number) { const selection = window.getSelection()!; const range = document.createRange(); range.setStart(node, start); range.setEnd(node, end); selection.removeAllRanges(); selection.addRange(range); return selection }

describe('reader text anchors', () => {
  it('uses UTF-16 offsets and keeps exact context for a wrapped link', () => {
    document.body.innerHTML = '<article data-reader-section-id="chapter-1"><p data-reader-block-id="one">😀 First block.</p><p data-reader-block-id="two">Second <a>block</a> with a <span>link</span>.</p></article>'
    const block = document.querySelector('[data-reader-block-id="one"]')!.firstChild!
    const result = createTextAnchorFromSelection(selectionIn(block, 3, 8), { sections })
    expect('segments' in result && result.segments[0]).toMatchObject({ startOffset: 3, endOffset: 8, exact: 'First', prefix: '😀 ', suffix: ' block.' })
    const link = document.querySelector('[data-reader-block-id="two"] a')!.firstChild!
    const linkResult = createTextAnchorFromSelection(selectionIn(link, 0, 5), { sections })
    expect('segments' in linkResult && linkResult.segments[0].exact).toBe('block')
  })

  it('supports continuous blocks and rejects collapsed, outside, and cross-section selections', () => {
    document.body.innerHTML = '<article data-reader-section-id="chapter-1"><p data-reader-block-id="one">First</p><p data-reader-block-id="two">Second</p></article><article data-reader-section-id="chapter-2"><p data-reader-block-id="three">Another chapter.</p></article><aside>Outside</aside>'
    const first = document.querySelector('[data-reader-block-id="one"]')!.firstChild!
    const second = document.querySelector('[data-reader-block-id="two"]')!.firstChild!
    const crossBlock = selectionIn(first, 2, 5); const range = crossBlock.getRangeAt(0); range.setEnd(second, 3)
    const result = createTextAnchorFromSelection(crossBlock, { sections })
    expect('segments' in result && result.segments).toHaveLength(2)
    expect(createTextAnchorFromSelection(selectionIn(first, 2, 2), { sections })).toEqual({ reason: 'empty' })
    const outside = document.querySelector('aside')!.firstChild!; expect(createTextAnchorFromSelection(selectionIn(outside, 0, 5), { sections })).toEqual({ reason: 'outside-reader' })
    const crossChapter = document.querySelector('[data-reader-block-id="three"]')!.firstChild!; const crossSelection = selectionIn(first, 0, 2); crossSelection.getRangeAt(0).setEnd(crossChapter, 3); expect(createTextAnchorFromSelection(crossSelection, { sections })).toEqual({ reason: 'cross-section' })
  })

  it('maps selections through span and mark wrappers without splitting emoji boundaries', () => {
    document.body.innerHTML = '<article data-reader-section-id="chapter-1"><p data-reader-block-id="one"><span>😀 Fi</span><mark>rst block.</mark></p></article>'
    const start = document.querySelector('span')!.firstChild!; const end = document.querySelector('mark')!.firstChild!; const selection = selectionIn(start, 3, 4); selection.getRangeAt(0).setEnd(end, 4)
    const result = createTextAnchorFromSelection(selection, { sections })
    expect('segments' in result && result.segments[0]).toMatchObject({ startOffset: 3, endOffset: 9, exact: 'First ' })
  })

  it('recovers changed offsets and marks ambiguous content orphaned', () => {
    const annotation = { id: 'a', resourceKey: 'imported:book', anchorKey: 'old', segments: [{ sectionId: 'chapter-1', sectionIndex: 0, blockId: 'one', startOffset: 2, endOffset: 7, exact: 'First', prefix: '', suffix: ' block.' }], quote: 'First', color: 'lavender' as const, createdAt: 1, updatedAt: 1 }
    const recovered = recoverAnnotation(annotation, [{ ...sections[0], blocks: [{ ...sections[0].blocks[0], text: 'prefix 😀 First block.' }] }])
    expect(recovered.status).toBe('recovered'); expect(recovered.segments[0].startOffset).toBeGreaterThan(2)
    const orphaned = recoverAnnotation(annotation, [{ ...sections[0], blocks: [{ ...sections[0].blocks[0], text: 'First First' }] }])
    expect(orphaned.status).toBe('orphaned'); expect(orphaned.annotation.orphaned).toBe(true)
    const moved = recoverAnnotation(annotation, [{ ...sections[0], blocks: [{ id: 'replacement', type: 'paragraph', text: 'prefix 😀 First block.', order: 4 }, sections[0].blocks[1]] }])
    expect(moved.status).toBe('recovered'); expect(moved.segments[0]).toMatchObject({ blockId: 'replacement', blockOrder: 4 })
    act(() => window.getSelection()?.removeAllRanges())
  })
})
