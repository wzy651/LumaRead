// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { pageColumnWidth, pageCountFromMetrics, pageIndexFromProgress, pageTurnTarget } from './pagination'
import { isReaderSwipe, isSwipeBlockedTarget, readerSwipeBehavior } from './swipeNavigation'

describe('pagination and swipe decisions', () => {
  it('counts empty and short sections as one quiet page', () => {
    expect(pageCountFromMetrics(700, 700)).toBe(1)
    expect(pageCountFromMetrics(200, 700)).toBe(1)
  })
  it('counts overflow pages and handles invalid measurements', () => {
    expect(pageCountFromMetrics(1401, 700)).toBe(3)
    expect(pageCountFromMetrics(1200, 0)).toBe(1)
    expect(pageCountFromMetrics(751, 751, 664, 152, 64)).toBe(1)
    expect(pageCountFromMetrics(1416, 751, 664, 152, 64)).toBe(2)
    expect(pageCountFromMetrics(342, 342, 310, 0, 28)).toBe(1)
  })
  it('uses the full content viewport for columns and adds the inter-column gap to the page stride', () => {
    expect(pageColumnWidth(302)).toBe(302)
    expect(pageColumnWidth(302) + 28).toBe(330)
    expect(pageColumnWidth(Number.NaN)).toBe(1)
  })
  it('restores older progress-only locations after the page count is measured', () => {
    expect(pageIndexFromProgress(50, 4)).toBe(2)
    expect(pageIndexFromProgress(-20, 4)).toBe(0)
    expect(pageIndexFromProgress(150, 4)).toBe(3)
    expect(pageIndexFromProgress(50, 1)).toBe(0)
    expect(pageIndexFromProgress(Number.NaN, 4)).toBe(0)
  })
  it('moves through pages and adjacent chapter edges without wrapping', () => {
    expect(pageTurnTarget(0, 4, 1, 3, -1)).toMatchObject({ sectionIndex: 0, boundary: 'last' })
    expect(pageTurnTarget(3, 4, 1, 3, 1)).toMatchObject({ sectionIndex: 2, boundary: 'first' })
    expect(pageTurnTarget(0, 4, 0, 3, -1)).toMatchObject({ pageIndex: 0, sectionIndex: 0 })
    expect(pageTurnTarget(3, 4, 2, 3, 1)).toMatchObject({ pageIndex: 3, sectionIndex: 2 })
    expect(pageTurnTarget(1, 4, 1, 3, 1)).toMatchObject({ pageIndex: 2, sectionIndex: 1 })
  })
  it('accepts deliberate horizontal gestures and filters vertical, text, edge and multi touch', () => {
    expect(isReaderSwipe({ x: 200, y: 300, pointerCount: 1 }, { x: 110, y: 310 })).toBe(true)
    expect(isReaderSwipe({ x: 200, y: 300 }, { x: 190, y: 390 })).toBe(false)
    expect(isReaderSwipe({ x: 200, y: 300, pointerCount: 2 }, { x: 100, y: 300 })).toBe(false)
    expect(isReaderSwipe({ x: 200, y: 300, startedAtEdge: true }, { x: 100, y: 300 })).toBe(false)
    expect(isReaderSwipe({ x: 200, y: 300 }, { x: 100, y: 300 }, 'selected')).toBe(false)
  })
  it('blocks gestures that start from links, controls, sheets, editors, and PDF text layers', () => {
    const targets = ['a', 'button', 'input', 'textarea', 'select', '[contenteditable="true"]', '.reader-panel', '.reader-bottom-sheet', '.reader-footnote', '.pdf-text-layer', '.textLayer', '.annotation-editor', '.selection-toolbar'].map((selector) => { const element = document.createElement(selector.startsWith('.') ? 'div' : selector.startsWith('[') ? 'div' : selector); if (selector.startsWith('.')) element.className = selector.slice(1); if (selector.startsWith('[')) element.setAttribute('contenteditable', 'true'); document.body.append(element); return element })
    try { for (const target of targets) expect(isSwipeBlockedTarget(target)).toBe(true); expect(isSwipeBlockedTarget(document.createElement('article'))).toBe(false) } finally { document.body.replaceChildren() }
  })
  it('selects the intended swipe action for each reader format and mode', () => {
    expect(readerSwipeBehavior('epub', 'pages', 3)).toBe('page')
    expect(readerSwipeBehavior('epub', 'scroll', 3)).toBe('section')
    expect(readerSwipeBehavior('txt', 'scroll', 2)).toBe('section')
    expect(readerSwipeBehavior('docx', 'scroll', 2)).toBe('section')
    expect(readerSwipeBehavior('txt', 'scroll', 1)).toBe('none')
    expect(readerSwipeBehavior('pdf', 'original', 12)).toBe('page')
    expect(readerSwipeBehavior('pdf', 'reading', 12)).toBe('none')
  })
})
