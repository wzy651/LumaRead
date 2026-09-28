// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import { AndroidNavigation } from './AndroidNavigation'

const bridge = vi.hoisted(() => ({ runtime: 'tauri-android', listen: vi.fn(), invoke: vi.fn() }))
vi.mock('./runtime', () => ({ getRuntime: () => bridge.runtime }))
vi.mock('@tauri-apps/api/app', () => ({ onBackButtonPress: bridge.listen }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: bridge.invoke }))
function Path() { return <output>{useLocation().pathname}</output> }
const cleanup: (() => void)[] = []
async function mount(path = '/') {
  const host = document.createElement('div'); document.body.append(host)
  const root = createRoot(host)
  await act(async () => { root.render(<MemoryRouter initialEntries={[path]}><AndroidNavigation /><Path /></MemoryRouter>) })
  const unmount = () => { act(() => root.unmount()); host.remove() }
  cleanup.push(unmount)
  return { host, unmount }
}
afterEach(() => { for (const fn of cleanup.splice(0)) fn(); vi.resetAllMocks(); bridge.runtime = 'tauri-android' })

it('registers native Back, returns home, then closes only from Home', async () => {
  let back = () => {}
  const unregister = vi.fn().mockResolvedValue(undefined)
  bridge.listen.mockImplementation(async (handler: () => void) => { back = handler; return { unregister } })
  bridge.invoke.mockResolvedValue(undefined)
  const { host } = await mount('/settings')
  await act(async () => { back() })
  expect(host.textContent).toBe('/')
  expect(bridge.invoke).not.toHaveBeenCalled()
  await act(async () => { back() })
  expect(bridge.invoke).toHaveBeenCalledWith('close_mobile_app')
  expect(unregister).toHaveBeenCalledOnce()
})

it('unregisters a subscription that arrives after unmount', async () => {
  let resolve!: (listener: { unregister: () => Promise<void> }) => void
  bridge.listen.mockReturnValue(new Promise((done) => { resolve = done }))
  const { unmount } = await mount()
  unmount(); cleanup.pop()
  const unregister = vi.fn().mockRejectedValue(new Error('activity already closed'))
  await act(async () => { resolve({ unregister }) })
  expect(unregister).toHaveBeenCalledOnce()
})

it('does not register mobile listeners in Windows or browser builds', async () => {
  for (const runtime of ['tauri-windows', 'browser']) { bridge.runtime = runtime; await mount() }
  expect(bridge.listen).not.toHaveBeenCalled()
})
