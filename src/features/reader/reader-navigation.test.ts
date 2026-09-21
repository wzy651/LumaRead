// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { createNavigationHistory, navigateToLocator, ReaderNavigationHistory } from './reader-navigation'

const first = { version: 1 as const, kind: 'pdf' as const, resourceKey: 'imported:book', pageNumber: 1 }
const second = { ...first, pageNumber: 2 }

describe('reader navigation history', () => {
  it('pushes, backs, and clears locators', () => {
    const history = createNavigationHistory()
    expect(history).toBeInstanceOf(ReaderNavigationHistory)
    expect(history.canGoBack()).toBe(false)
    history.push(first); history.push(second)
    expect(history.canGoBack()).toBe(true)
    expect(history.back()).toEqual(second)
    expect(history.back()).toEqual(first)
    expect(history.canGoBack()).toBe(false)
    history.push(first); history.clear(); expect(history.canGoBack()).toBe(false); expect(history.back()).toBeUndefined()
  })

  it('does not save invalid locators in history', () => {
    const history = createNavigationHistory()
    history.push({ kind: 'pdf', version: 1, resourceKey: 'not-valid', pageNumber: 1 } as never)
    expect(history.canGoBack()).toBe(false)
  })

  it('waits for a new section render before resolving a duplicate block id', () => {
    const sections = [{ id: 'chapter-1', blocks: [{ id: 'shared', type: 'paragraph' as const, text: 'one', order: 0 }] }, { id: 'chapter-2', blocks: [{ id: 'shared', type: 'paragraph' as const, text: 'two', order: 0 }] }]
    const oldBlock = document.createElement('p'); oldBlock.dataset.readerBlockId = 'shared'; oldBlock.scrollIntoView = vi.fn(); document.body.replaceChildren(oldBlock)
    const onSectionChange = vi.fn()
    const locator = { version: 1 as const, kind: 'reflowable' as const, resourceKey: 'imported:book', sectionId: 'chapter-2', sectionIndex: 1, blockId: 'shared' }
    expect(navigateToLocator(locator, { resourceKey: 'imported:book', sections, sectionIndex: 0, onSectionChange })).toBe(false)
    expect(onSectionChange).toHaveBeenCalledWith(1)
    expect(oldBlock.scrollIntoView).not.toHaveBeenCalled()

    const newBlock = document.createElement('p'); newBlock.dataset.readerBlockId = 'shared'; newBlock.scrollIntoView = vi.fn(); document.body.replaceChildren(newBlock)
    expect(navigateToLocator(locator, { resourceKey: 'imported:book', sections, sectionIndex: 1 })).toBe(true)
    expect(newBlock.scrollIntoView).toHaveBeenCalledWith({ block: 'start', behavior: 'auto' })
  })
})
