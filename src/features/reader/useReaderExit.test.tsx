// @vitest-environment jsdom
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useReaderExit } from './useReaderExit'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function Harness({ flushLocation, navigateHome }: { flushLocation: () => Promise<void>; navigateHome: () => void }) {
  const [overlayOpen, setOverlayOpen] = useState(true)
  useReaderExit({ closeOverlay: () => setOverlayOpen(false), flushLocation, navigateHome, overlayOpen })
  return <main><output data-testid="overlay">{String(overlayOpen)}</output><input data-testid="input" /></main>
}

describe('useReaderExit', () => {
  let root: Root | undefined
  let container: HTMLDivElement
  let flushLocation: ReturnType<typeof vi.fn<() => Promise<void>>>
  let navigateHome: ReturnType<typeof vi.fn<() => void>>

  beforeEach(() => {
    container = document.createElement('div')
    document.body.append(container)
    flushLocation = vi.fn<() => Promise<void>>(() => Promise.resolve())
    navigateHome = vi.fn<() => void>()
    root = createRoot(container)
    act(() => root?.render(<Harness flushLocation={flushLocation} navigateHome={navigateHome} />))
  })

  afterEach(() => {
    if (root) act(() => root?.unmount())
    root = undefined
    container.remove()
  })

  it('closes the panel first, then flushes and exits on the second Escape', async () => {
    await act(async () => { document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Escape' })) })
    expect(container.querySelector('[data-testid="overlay"]')?.textContent).toBe('false')
    expect(flushLocation).not.toHaveBeenCalled()
    expect(navigateHome).not.toHaveBeenCalled()
    await act(async () => { document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Escape' })); await Promise.resolve() })
    expect(flushLocation).toHaveBeenCalledTimes(1)
    expect(navigateHome).toHaveBeenCalledTimes(1)
  })

  it('does not exit from an input or during IME composition', async () => {
    const input = container.querySelector('[data-testid="input"]') as HTMLInputElement
    await act(async () => { input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Escape' })); await Promise.resolve() })
    expect(navigateHome).not.toHaveBeenCalled()
    await act(async () => { document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Escape', isComposing: true })); await Promise.resolve() })
    expect(navigateHome).not.toHaveBeenCalled()
  })
})
