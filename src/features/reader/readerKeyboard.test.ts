// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getReaderNavigationAction, getReaderSectionNavigationDelta, isReaderKeyboardEventBlocked, shouldToggleReaderChrome } from './readerKeyboard'

afterEach(() => {
  vi.unstubAllGlobals()
  window.getSelection()?.removeAllRanges()
})

function key(key: string, options: KeyboardEventInit = {}) {
  return new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key, ...options })
}

function keyFromTarget(target: EventTarget, keyName: string) {
  const event = key(keyName)
  Object.defineProperty(event, 'target', { configurable: true, value: target })
  return event
}

describe('reader keyboard policy', () => {
  it('maps only plain arrows and Ctrl+Page navigation', () => {
    expect(getReaderSectionNavigationDelta(key('ArrowLeft'))).toBe(-1)
    expect(getReaderSectionNavigationDelta(key('ArrowRight'))).toBe(1)
    expect(getReaderSectionNavigationDelta(key('ArrowRight', { shiftKey: true }))).toBeUndefined()
    expect(getReaderSectionNavigationDelta(key('ArrowRight', { ctrlKey: true }))).toBeUndefined()
    expect(getReaderSectionNavigationDelta(key('PageUp', { ctrlKey: true }))).toBe(-1)
    expect(getReaderSectionNavigationDelta(key('PageDown', { ctrlKey: true }))).toBe(1)
    expect(getReaderSectionNavigationDelta(key('PageDown', { ctrlKey: true, shiftKey: true }))).toBeUndefined()
    expect(getReaderSectionNavigationDelta(key('PageDown', { ctrlKey: true, altKey: true }))).toBeUndefined()
    expect(getReaderSectionNavigationDelta(key('ArrowRight', { repeat: true }))).toBeUndefined()
  })

  it('dispatches page turns and chapter jumps by mode while respecting boundaries and focus', () => {
    expect(getReaderNavigationAction(key('ArrowLeft'), 'pages', 1, 3)).toBe('previous-page')
    expect(getReaderNavigationAction(key('PageDown'), 'pages', 1, 3)).toBe('next-page')
    expect(getReaderNavigationAction(key('ArrowRight'), 'scroll', 1, 3)).toBe('next-section')
    expect(getReaderNavigationAction(key('PageDown'), 'scroll', 1, 3)).toBeUndefined()
    expect(getReaderNavigationAction(key('PageUp', { ctrlKey: true }), 'pages', 1, 3)).toBe('previous-section')
    expect(getReaderNavigationAction(key('PageDown', { ctrlKey: true }), 'scroll', 0, 3)).toBe('next-section')
    expect(getReaderNavigationAction(key('PageUp', { ctrlKey: true }), 'pages', 0, 3)).toBeUndefined()
    expect(getReaderNavigationAction(keyFromTarget(document.createElement('input'), 'PageDown'), 'pages', 0, 3)).toBeUndefined()
    expect(getReaderNavigationAction(key('ArrowRight', { repeat: true }), 'pages', 0, 3)).toBeUndefined()
  })

  it('blocks chapter navigation from controls, panels, composing input, and selection', () => {
    const container = document.createElement('div')
    container.innerHTML = '<button>button</button><a href="/">link</a><input /><textarea></textarea><select></select><div contenteditable="true">edit</div><div class="reader-panel">panel</div><div class="textLayer">pdf text</div><span class="reader-word">word</span><span class="reader-sentence-target">sentence</span><span id="content">reader text</span>'
    document.body.append(container)
    for (const element of Array.from(container.querySelectorAll('button, a, input, textarea, select, [contenteditable="true"], .reader-panel, .textLayer, .reader-word, .reader-sentence-target'))) {
      expect(isReaderKeyboardEventBlocked(keyFromTarget(element, 'ArrowRight'))).toBe(true)
    }

    const content = container.querySelector('#content') as HTMLElement
    const range = document.createRange()
    range.selectNodeContents(content)
    window.getSelection()?.addRange(range)
    expect(isReaderKeyboardEventBlocked(keyFromTarget(content, 'ArrowRight'))).toBe(true)
    window.getSelection()?.removeAllRanges()

    const composing = key('ArrowRight', { isComposing: true })
    expect(isReaderKeyboardEventBlocked(composing)).toBe(true)
    const prevented = key('ArrowRight')
    prevented.preventDefault()
    expect(isReaderKeyboardEventBlocked(prevented)).toBe(true)
  })

  it('only toggles chrome for non-interactive, unselected content', () => {
    const main = document.createElement('main')
    const text = document.createElement('span')
    const button = document.createElement('button')
    main.append(text, button)
    expect(shouldToggleReaderChrome({ currentTarget: main, target: text })).toBe(true)
    expect(shouldToggleReaderChrome({ currentTarget: main, target: button })).toBe(false)
    expect(shouldToggleReaderChrome({ currentTarget: main, target: text, selectedText: 'selected' })).toBe(false)
    expect(shouldToggleReaderChrome({ currentTarget: main, target: text, defaultPrevented: true })).toBe(false)
  })
})
