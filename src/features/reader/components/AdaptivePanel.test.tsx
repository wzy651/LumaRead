// @vitest-environment jsdom
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AdaptivePanel } from './AdaptivePanel'
import { useReaderExit } from '../useReaderExit'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

describe('AdaptivePanel Escape ownership', () => {
  let root: Root | undefined
  let container: HTMLDivElement
  let anchor: HTMLButtonElement

  afterEach(() => {
    if (root) act(() => root?.unmount())
    root = undefined
    container.remove()
    anchor.remove()
  })

  it('lets the reader close the panel on Escape before the next Escape exits', async () => {
    container = document.createElement('div')
    anchor = document.createElement('button')
    document.body.append(anchor, container)
    const navigateHome = vi.fn()
    function Harness() {
      const [open, setOpen] = useState(true)
      useReaderExit({ overlayOpen: open, closeOverlay: () => setOpen(false), flushLocation: () => undefined, navigateHome })
      return open ? <AdaptivePanel anchorElement={anchor} isMobile label="Notes" onClose={() => setOpen(false)} variant="more">Panel</AdaptivePanel> : null
    }
    root = createRoot(container)
    act(() => root?.render(<Harness />))
    await act(async () => { document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Escape' })) })
    expect(container.querySelector('[role="dialog"]')).toBeNull()
    expect(navigateHome).not.toHaveBeenCalled()
    await act(async () => { document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Escape' })); await Promise.resolve() })
    expect(navigateHome).toHaveBeenCalledTimes(1)
  })
})
