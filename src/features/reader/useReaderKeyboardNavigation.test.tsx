// @vitest-environment jsdom
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useReaderKeyboardNavigation } from './useReaderKeyboardNavigation'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function Harness() {
  const [section, setSection] = useState(0)
  useReaderKeyboardNavigation({ onSectionChange: setSection, sectionCount: 3, sectionIndex: section })
  return <main><output data-testid="section">{section}</output><div data-testid="content">section content</div><div className="reader-panel" data-testid="panel">panel</div><button data-testid="button" type="button">button</button><a data-testid="link" href="/">link</a><input data-testid="input" /></main>
}

describe('useReaderKeyboardNavigation', () => {
  let root: Root | undefined
  let container: HTMLDivElement

  beforeEach(() => {
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    act(() => root?.render(<Harness />))
  })

  afterEach(() => {
    if (root) act(() => root?.unmount())
    root = undefined
    container.remove()
  })

  function section() { return container.querySelector('[data-testid="section"]')?.textContent }
  function press(target: EventTarget, key: string, options: KeyboardEventInit = {}) { act(() => { target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key, ...options })) }) }

  it('moves across three sections and stops at both edges', () => {
    const content = container.querySelector('[data-testid="content"]') as HTMLElement
    press(content, 'ArrowLeft')
    expect(section()).toBe('0')
    press(content, 'ArrowRight')
    expect(section()).toBe('1')
    press(content, 'PageDown', { ctrlKey: true })
    expect(section()).toBe('2')
    press(content, 'ArrowRight')
    expect(section()).toBe('2')
    press(content, 'PageUp', { ctrlKey: true })
    expect(section()).toBe('1')
    press(content, 'ArrowLeft')
    expect(section()).toBe('0')
  })

  it('does not skip sections on repeat or Shift+Arrow', () => {
    const content = container.querySelector('[data-testid="content"]') as HTMLElement
    press(content, 'ArrowRight', { repeat: true })
    expect(section()).toBe('0')
    press(content, 'ArrowRight', { shiftKey: true })
    expect(section()).toBe('0')
  })

  it('ignores selection, panels, and focused controls', () => {
    const content = container.querySelector('[data-testid="content"]') as HTMLElement
    const range = document.createRange()
    range.selectNodeContents(content)
    window.getSelection()?.addRange(range)
    press(content, 'ArrowRight')
    expect(section()).toBe('0')
    window.getSelection()?.removeAllRanges()
    press(container.querySelector('[data-testid="panel"]') as HTMLElement, 'ArrowRight')
    press(container.querySelector('[data-testid="button"]') as HTMLElement, 'ArrowRight')
    press(container.querySelector('[data-testid="link"]') as HTMLElement, 'ArrowRight')
    press(container.querySelector('[data-testid="input"]') as HTMLElement, 'ArrowRight')
    expect(section()).toBe('0')
  })
})
