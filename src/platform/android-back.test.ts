// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { handleAndroidBack } from './android-back'
afterEach(() => { document.body.innerHTML = '' })
it('lets the existing overlay close before navigating or exiting', () => {
  const input = document.createElement('button'); document.body.append(input); input.focus()
  const close = vi.fn((event: Event) => event.preventDefault()); input.addEventListener('keydown', close)
  const home = vi.fn(), exit = vi.fn()
  handleAndroidBack('/reader/book', home, exit)
  expect(close).toHaveBeenCalledOnce(); expect(home).not.toHaveBeenCalled(); expect(exit).not.toHaveBeenCalled()
})
it('returns secondary pages home and exits only from Home', () => {
  const home = vi.fn(), exit = vi.fn()
  handleAndroidBack('/statistics', home, exit); expect(home).toHaveBeenCalledOnce(); expect(exit).not.toHaveBeenCalled()
  handleAndroidBack('/', home, exit); expect(exit).toHaveBeenCalledOnce()
})
it('blurs an unhandled editor without discarding its page', () => {
  const input = document.createElement('textarea'); document.body.append(input); input.focus()
  const home = vi.fn(), exit = vi.fn()
  handleAndroidBack('/settings', home, exit)
  expect(document.activeElement).not.toBe(input); expect(home).not.toHaveBeenCalled(); expect(exit).not.toHaveBeenCalled()
})
