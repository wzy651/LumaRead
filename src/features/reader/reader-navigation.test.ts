import { describe, expect, it } from 'vitest'
import { createNavigationHistory, ReaderNavigationHistory } from './reader-navigation'

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
})
