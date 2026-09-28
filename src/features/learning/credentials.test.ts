// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest'
const native = vi.hoisted(() => ({ invoke: vi.fn(), platform: 'tauri-windows', endpoint: '' }))
vi.mock('../../platform/runtime', () => ({ getRuntime: () => native.platform, isTauriRuntime: () => native.platform !== 'browser' }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: native.invoke }))
import { clearRememberedCredential, clearSessionKey, contextEndpoint, ensureContextConfigured, getSessionKey, rememberCredential, saveAISettings } from './settings'
import { ConfiguredContextProvider } from './context-provider'
const settings = { protocol: 'compatible' as const, baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat' }
beforeEach(() => {
  localStorage.clear(); clearSessionKey(); native.platform = 'tauri-windows'; native.endpoint = ''
  native.invoke.mockReset().mockImplementation(async (command: string, args?: { endpoint: string }) => {
    if (command === 'save_reading_credential') native.endpoint = args!.endpoint
    if (command === 'clear_reading_credential') native.endpoint = ''
    if (command === 'reading_credential_status') return native.endpoint === args!.endpoint
    if (command === 'request_reading_context') return { status: 200, body: JSON.stringify({ choices: [{ message: { content: '河岸' } }] }) }
  })
})
it('restores only presence after restart and native transport receives no plaintext stored key', async () => {
  saveAISettings(settings, 'fixture-only-key')
  await rememberCredential(settings, 'fixture-only-key', true)
  clearSessionKey() // app restart: the JS secret is gone, native secure storage remains
  expect(getSessionKey()).toBe('')
  expect(await ensureContextConfigured()).toBe(true)
  expect(JSON.stringify(localStorage)).not.toContain('fixture-only-key')
  const answer = await new ConfiguredContextProvider().explain({ text: 'bank', sentence: 'The bank of the river.', bookTitle: 'fixture', resourceKey: 'fixture' }, 'context', new AbortController().signal)
  expect(answer).toBe('河岸')
  expect(native.invoke).toHaveBeenCalledWith('request_reading_context', expect.objectContaining({ apiKey: '', endpoint: contextEndpoint(settings) }))
})
it('never reuses the stored key after changing providers and clears both session and native credentials', async () => {
  saveAISettings(settings, 'fixture'); await rememberCredential(settings, 'fixture', true)
  saveAISettings({ ...settings, baseUrl: 'https://other.example' }, '')
  expect(await ensureContextConfigured()).toBe(false)
  await clearRememberedCredential(); expect(getSessionKey()).toBe(''); expect(native.endpoint).toBe('')
})
it('does not use plaintext persistence as fallback on browser or Android', async () => {
  for (const platform of ['browser', 'tauri-android']) {
    native.platform = platform; saveAISettings(settings, 'fixture')
    expect(await rememberCredential(settings, 'fixture', true)).toBe(false)
    clearSessionKey(); expect(await ensureContextConfigured()).toBe(false)
  }
  expect(native.invoke).not.toHaveBeenCalled()
})
