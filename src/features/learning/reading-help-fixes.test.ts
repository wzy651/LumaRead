// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { contextRequestBody, extractAnswer, serviceError, ConfiguredContextProvider } from './context-provider'
import { clearSessionKey, saveAISettings } from './settings'
import { excerptFromSelection, rangeForText } from './selection'
import { englishVoice, pronounce } from './pronunciation'

const excerpt = { text: 'bank', sentence: 'She sat on the bank of the river.', resourceKey: 'fixture', bookTitle: '' }
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); localStorage.clear(); clearSessionKey(); document.body.replaceChildren() })
it('disables thinking only for official DeepSeek, keeps the selected model and bounds output', () => {
  const settings = { protocol: 'compatible' as const, baseUrl: 'https://api.deepseek.com/v1', model: 'user-selected-model' }
  for (const mode of ['context', 'translate', 'simplify', 'detail'] as const) {
    expect(contextRequestBody(settings, excerpt, mode)).toMatchObject({ model: settings.model, thinking: { type: 'disabled' }, max_tokens: mode === 'detail' ? 2400 : 1200, stream: false })
  }
  for (const baseUrl of ['https://other.example/v1', 'https://api.deepseek.com.evil.example', 'http://localhost:9999']) expect(contextRequestBody({ ...settings, baseUrl }, excerpt, 'context')).not.toHaveProperty('thinking')
})
it('rejects reasoning-only and truncated answers with actionable messages, never displaying reasoning', () => {
  expect(() => extractAnswer({ choices: [{ finish_reason: 'length', message: { content: '', reasoning_content: 'private trace' } }] }, 'compatible')).toThrow('输出额度')
  expect(() => extractAnswer({ choices: [{ message: { content: '', reasoning_content: 'private trace' } }] }, 'compatible')).toThrow('没有最终答案')
  expect(() => extractAnswer({ choices: [{ finish_reason: 'length', message: { content: 'incomplete' } }] }, 'compatible')).toThrow('输出额度')
  expect(serviceError(402)).toContain('余额')
})
it('does not automatically retry or bill again after an empty DeepSeek result', async () => {
  saveAISettings({ protocol: 'compatible', baseUrl: 'https://api.deepseek.com', model: 'test-model' }, 'test-only')
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ finish_reason: 'length', message: { content: null } }] })))
  vi.stubGlobal('fetch', fetcher)
  await expect(new ConfiguredContextProvider().explain(excerpt, 'context', new AbortController().signal)).rejects.toThrow('输出额度')
  expect(fetcher).toHaveBeenCalledOnce()
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({ thinking: { type: 'disabled' } })
})
it('keeps the exact repeated word occurrence, survives cleared native selection and handles split spans', () => {
  const root = document.createElement('div'); root.className = 'reader-shell'
  const p = document.createElement('p'); p.dataset.readerBlockId = 'b'; p.append('The bank beside another ')
  const first = document.createElement('span'); first.textContent = 'ba'; p.append(first)
  const second = document.createElement('span'); second.textContent = 'nk'; p.append(second, ' was quiet.')
  root.append(p); document.body.append(root)
  const start = p.textContent!.lastIndexOf('bank'), range = rangeForText(p, start, start + 4)!
  expect(range.toString()).toBe('bank')
  Object.defineProperty(range, 'getBoundingClientRect', { value: () => new DOMRect(10, 20, 30, 18) })
  const selection = window.getSelection()!; selection.removeAllRanges(); selection.addRange(range)
  const located = excerptFromSelection(root, { resourceKey: 'fixture', bookTitle: '' })!
  selection.removeAllRanges()
  expect(located.range?.toString()).toBe('bank'); expect(located.excerpt.selectionStart).toBe(start)
})
it('prefers a local English voice over default Chinese and remote voices', () => {
  const voices = [{ lang: 'zh-CN', localService: true }, { lang: 'en-US', localService: false }, { lang: 'en-GB', localService: true }] as SpeechSynthesisVoice[]
  expect(englishVoice(voices)).toBe(voices[2]); expect(englishVoice(voices.slice(0, 1))).toBeUndefined()
})
it('pronounces the selected word, supports slow rate, and stops on cancellation', async () => {
  const synth = new EventTarget() as EventTarget & { getVoices: ReturnType<typeof vi.fn>; speak: ReturnType<typeof vi.fn>; cancel: ReturnType<typeof vi.fn> }
  synth.getVoices = vi.fn().mockReturnValue([{ lang: 'en-US', localService: true }]); synth.cancel = vi.fn(); synth.speak = vi.fn()
  vi.stubGlobal('speechSynthesis', synth)
  vi.stubGlobal('SpeechSynthesisUtterance', class { text: string; constructor(text: string) { this.text = text } })
  const controller = new AbortController(), promise = pronounce('went', 'slow', controller.signal)
  const rejected = expect(promise).rejects.toMatchObject({ name: 'AbortError' })
  expect(synth.speak.mock.calls[0][0]).toMatchObject({ text: 'went', rate: 0.65, lang: 'en-US' })
  controller.abort(); await rejected; expect(synth.cancel).toHaveBeenCalledTimes(2)
})
it('waits for voiceschanged and resolves only after playback finishes', async () => {
  const synth = Object.assign(new EventTarget(), { getVoices: vi.fn().mockReturnValue([]), cancel: vi.fn(), speak: vi.fn() })
  vi.stubGlobal('speechSynthesis', synth); vi.stubGlobal('SpeechSynthesisUtterance', class {})
  const promise = pronounce('bank', 'normal', new AbortController().signal)
  expect(synth.speak).not.toHaveBeenCalled()
  synth.getVoices.mockReturnValue([{ lang: 'en-US', localService: true }]); synth.dispatchEvent(new Event('voiceschanged'))
  await Promise.resolve(); const utterance = synth.speak.mock.calls[0][0]
  expect(utterance.rate).toBe(0.9); utterance.onstart(); utterance.onend(); await promise
})
it('reports missing English voices instead of silently pretending to play', async () => {
  const synth = { getVoices: () => [{ lang: 'zh-CN', localService: true }], cancel: vi.fn(), speak: vi.fn() }
  vi.stubGlobal('speechSynthesis', synth); vi.stubGlobal('SpeechSynthesisUtterance', class {})
  await expect(pronounce('bank', 'normal', new AbortController().signal)).rejects.toThrow('英语语音')
  expect(synth.speak).not.toHaveBeenCalled()
})
