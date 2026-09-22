// @vitest-environment jsdom
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useReaderSearchShortcut } from './useReaderSearchShortcut'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function ShortcutProbe({ onOpen, onFocus }: { onOpen: () => void; onFocus: () => void }) {
  const [open, setOpen] = useState(false)
  useReaderSearchShortcut({ open: () => { onOpen(); setOpen(true) }, focus: onFocus, openAlready: open })
  return <button onClick={() => setOpen(true)} type="button">{open ? 'open' : 'closed'}</button>
}

describe('useReaderSearchShortcut', () => {
  let root: Root | undefined
  let container: HTMLDivElement

  afterEach(() => {
    act(() => root?.unmount())
    root = undefined
    container?.remove()
  })

  it('opens on Ctrl+F, then focuses and selects on repeated Ctrl+F, while ignoring IME composition', () => {
    container = document.createElement('div')
    document.body.append(container)
    const onOpen = vi.fn()
    const onFocus = vi.fn()
    root = createRoot(container)
    act(() => { root?.render(<ShortcutProbe onFocus={onFocus} onOpen={onOpen} />) })

    act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, ctrlKey: true, key: 'f' })) })
    expect(onOpen).toHaveBeenCalledTimes(1)
    act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, ctrlKey: true, key: 'f' })) })
    expect(onFocus).toHaveBeenCalledTimes(1)
    const composing = new KeyboardEvent('keydown', { bubbles: true, ctrlKey: true, key: 'f' })
    Object.defineProperty(composing, 'isComposing', { value: true })
    act(() => { document.dispatchEvent(composing) })
    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(onFocus).toHaveBeenCalledTimes(1)
  })
})
