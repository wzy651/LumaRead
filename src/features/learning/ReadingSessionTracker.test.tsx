// @vitest-environment jsdom
import { act, StrictMode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ReadingSessionTracker } from './ReadingSessionTracker'
import { saveReadingSession } from './reading-sessions'
vi.mock('./reading-sessions', async (original) => ({ ...await original<typeof import('./reading-sessions')>(), saveReadingSession: vi.fn().mockResolvedValue(undefined) }))
;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
let root: Root
let host: HTMLDivElement
beforeEach(() => { vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date', 'performance'] }); vi.spyOn(document, 'hasFocus').mockReturnValue(true); Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' }); vi.mocked(saveReadingSession).mockClear(); localStorage.clear(); host = document.createElement('div'); document.body.append(host); root = createRoot(host) })
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); vi.restoreAllMocks() })
it('survives StrictMode, persists on exit, pauses background, and cleans all timers', async () => {
  await act(async () => root.render(<StrictMode><ReadingSessionTracker resourceKey="book:one" bookTitle="One" /></StrictMode>))
  await act(async () => vi.advanceTimersByTimeAsync(10_000))
  expect(vi.mocked(saveReadingSession).mock.calls.at(-1)?.[0].activeMs).toBe(10_000)
  vi.mocked(document.hasFocus).mockReturnValue(false)
  window.dispatchEvent(new Event('blur'))
  await act(async () => vi.advanceTimersByTimeAsync(20_000))
  expect(vi.mocked(saveReadingSession).mock.calls.at(-1)?.[0].activeMs).toBe(10_000)
  vi.mocked(document.hasFocus).mockReturnValue(true); window.dispatchEvent(new Event('focus'))
  await act(async () => vi.advanceTimersByTimeAsync(3_000))
  await act(async () => root.unmount())
  expect(vi.mocked(saveReadingSession).mock.calls.at(-1)?.[0]).toMatchObject({ activeMs: 13_000, resourceKey: 'book:one', endedAt: expect.any(String) })
  expect(vi.getTimerCount()).toBe(0)
})
it('turns recording off immediately and starts a new session when enabled again', async () => {
  await act(async () => root.render(<ReadingSessionTracker resourceKey="book:one" bookTitle="One" />))
  await act(async () => vi.advanceTimersByTimeAsync(3_000))
  window.dispatchEvent(new CustomEvent('reading-time-preference', { detail: false }))
  const calls = vi.mocked(saveReadingSession).mock.calls.length
  await act(async () => vi.advanceTimersByTimeAsync(30_000))
  expect(vi.mocked(saveReadingSession).mock.calls).toHaveLength(calls)
  window.dispatchEvent(new CustomEvent('reading-time-preference', { detail: true }))
  await act(async () => vi.advanceTimersByTimeAsync(10_000))
  const recent = vi.mocked(saveReadingSession).mock.calls.at(-1)![0]
  expect(recent.id).not.toBe(vi.mocked(saveReadingSession).mock.calls[0][0].id)
  expect(recent.activeMs).toBeLessThanOrEqual(10_000)
})
