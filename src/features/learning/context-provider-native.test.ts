// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ConfiguredContextProvider } from './context-provider'
import { clearSessionKey, saveAISettings } from './settings'

const bridge = vi.hoisted(() => ({ invoke: vi.fn() }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: bridge.invoke }))
const excerpt = { text: 'bank', sentence: 'She sat on the bank of the river.', resourceKey: 'imported:test', bookTitle: 'Private title' }
beforeEach(() => {
  bridge.invoke.mockReset(); localStorage.clear(); clearSessionKey()
  Object.defineProperty(window, '__TAURI_INTERNALS__', { value: {}, configurable: true })
  saveAISettings({ protocol: 'compatible', baseUrl: 'https://example.com/v1', model: 'fixture' }, 'test-key-not-secret')
})
afterEach(() => { Reflect.deleteProperty(window, '__TAURI_INTERNALS__'); vi.restoreAllMocks() })
it('uses the bounded Tauri bridge rather than web fetch/CORS in the installed app', async () => {
  const fetcher = vi.spyOn(globalThis, 'fetch')
  bridge.invoke.mockResolvedValue({ status: 200, body: JSON.stringify({ choices: [{ message: { content: '河岸。' } }] }) })
  expect(await new ConfiguredContextProvider().explain(excerpt, 'context', new AbortController().signal)).toBe('河岸。')
  expect(fetcher).not.toHaveBeenCalled()
  expect(bridge.invoke).toHaveBeenCalledWith('request_reading_context', expect.objectContaining({ endpoint: 'https://example.com/v1/chat/completions', apiKey: 'test-key-not-secret' }))
  const body = JSON.parse(bridge.invoke.mock.calls[0][1].body)
  expect(body.messages[1].content).toContain(excerpt.sentence); expect(body.messages[1].content).not.toContain('Private title')
})
it('cancels the exact native request and rejects its late response', async () => {
  let resolve!: (result: unknown) => void
  bridge.invoke.mockImplementation((command: string) => command === 'request_reading_context' ? new Promise((done) => { resolve = done }) : Promise.resolve())
  const controller = new AbortController()
  const result = new ConfiguredContextProvider().explain(excerpt, 'context', controller.signal)
  const rejected = expect(result).rejects.toMatchObject({ name: 'AbortError' })
  await vi.waitFor(() => expect(bridge.invoke).toHaveBeenCalled())
  const requestId = bridge.invoke.mock.calls[0][1].requestId
  controller.abort()
  expect(bridge.invoke).toHaveBeenCalledWith('cancel_context_request', { requestId })
  resolve({ status: 200, body: '{"choices":[{"message":{"content":"late"}}]}' })
  await rejected
})
it('maps native authentication errors without showing server response details', async () => {
  bridge.invoke.mockResolvedValue({ status: 401, body: 'sensitive server text' })
  await expect(new ConfiguredContextProvider().explain(excerpt, 'context', new AbortController().signal)).rejects.toThrow('凭据')
})
