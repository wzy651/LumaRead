// @vitest-environment jsdom
import { act, StrictMode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { LookupContent } from './LookupContent'
import { ConfiguredContextProvider } from './context-provider'
import { saveAISettings, clearSessionKey } from './settings'
import type { LearningTerm, ReadingExcerpt } from './types'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
const mocks = vi.hoisted(() => ({ lookup: vi.fn(), record: vi.fn(), status: vi.fn() }))
vi.mock('./dictionary', () => ({ lookupDictionary: mocks.lookup }))
vi.mock('./repository', () => ({ recordLookup: mocks.record, setLearningStatus: mocks.status }))
const excerpt: ReadingExcerpt = { text: 'bank', sentence: 'She sat on the bank of the river.', resourceKey: 'imported:qa', bookTitle: 'River' }
let container: HTMLDivElement, root: Root
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((done) => { resolve = done }); return { promise, resolve } }
async function click(label: string) {
  const button = Array.from(container.querySelectorAll('button')).find((item) => item.textContent === label)
  expect(button, `Button: ${label}`).toBeDefined()
  await act(async () => button!.click())
}
async function mount(onSettings = vi.fn()) { await act(async () => root.render(<StrictMode><LookupContent excerpt={excerpt} onClose={vi.fn()} onSettings={onSettings} /></StrictMode>)) }
beforeEach(() => {
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
  localStorage.clear(); clearSessionKey()
  mocks.lookup.mockReset().mockResolvedValue({ word: 'bank', translation: '河岸；银行', definition: 'A river bank.', phonetic: '', source: 'ECDICT' })
  mocks.record.mockReset().mockResolvedValue({ term: { normalized: 'bank', text: 'bank', status: 'unknown', lookups: 1, lastSeen: '', example: excerpt } satisfies LearningTerm })
  mocks.status.mockReset().mockResolvedValue(undefined)
})
afterEach(() => { act(() => root.unmount()); container.remove(); vi.restoreAllMocks() })
it('records once under StrictMode and does not call AI or add to learning automatically', async () => {
  const explain = vi.spyOn(ConfiguredContextProvider.prototype, 'explain')
  await mount()
  expect(container.textContent).toContain('河岸；银行'); expect(mocks.record).toHaveBeenCalledTimes(1)
  expect(explain).not.toHaveBeenCalled(); expect(mocks.status).not.toHaveBeenCalled()
  await click('加入学习'); expect(mocks.status).toHaveBeenLastCalledWith('bank', 'learning')
  await click('已加入学习 · 撤销'); expect(mocks.status).toHaveBeenLastCalledWith('bank', 'unknown')
})
it('offers configuration without sending when no key exists', async () => {
  const settings = vi.fn(), explain = vi.spyOn(ConfiguredContextProvider.prototype, 'explain')
  await mount(settings); await click('这里是什么意思')
  expect(settings).toHaveBeenCalledOnce(); expect(explain).not.toHaveBeenCalled()
})
it('labels the phonetic lemma honestly and highlights the selected context occurrence', async () => {
  mocks.lookup.mockResolvedValue({ word: 'go', translation: '走', definition: '', phonetic: '[ɡəʊ]', source: 'ECDICT' })
  const selected = { ...excerpt, text: 'went', sentence: 'She went and he went too.', selectionStart: 16 }
  await act(async () => root.render(<LookupContent excerpt={selected} onClose={vi.fn()} onSettings={vi.fn()} />))
  expect(container.querySelector('.lookup-phonetic')?.textContent).toBe('go 的音标 /ɡəʊ/')
  const mark = container.querySelector('.lookup-context__selected')!
  expect(mark.textContent).toBe('went'); expect(mark.previousSibling?.textContent).toBe('She went and he ')
  expect(container.querySelector('[aria-label="播放英语发音"]')).not.toBeNull()
  expect(container.querySelector('[aria-label="慢速播放英语发音"]')).not.toBeNull()
})
it('cancels previous requests, ignores stale answers, caches only the current excerpt and cancels on unmount', async () => {
  saveAISettings({ protocol: 'compatible', baseUrl: 'https://example.com', model: 'reader' }, 'test-only')
  const one = deferred<string>(), two = deferred<string>(), three = deferred<string>()
  const explain = vi.spyOn(ConfiguredContextProvider.prototype, 'explain').mockReturnValueOnce(one.promise).mockReturnValueOnce(two.promise).mockReturnValueOnce(three.promise)
  await mount(); await click('这里是什么意思'); await click('Simple English')
  expect(explain.mock.calls[0][2].aborted).toBe(true)
  await act(async () => { two.resolve('She sat beside the river.'); one.resolve('STALE ANSWER') })
  expect(container.textContent).toContain('She sat beside the river.'); expect(container.textContent).not.toContain('STALE ANSWER')
  await click('Simple English'); expect(explain).toHaveBeenCalledTimes(2)
  await click('Explain more'); expect(explain).toHaveBeenCalledTimes(3)
  await act(async () => root.render(null)); expect(explain.mock.calls[2][2].aborted).toBe(true)
  await act(async () => three.resolve('After unmount')); expect(container.textContent).toBe('')
})
it('keeps dictionary reading available when storage or AI fails; retries explicitly', async () => {
  saveAISettings({ protocol: 'compatible', baseUrl: 'https://example.com', model: 'reader' }, 'test-only')
  mocks.record.mockRejectedValue(new Error('storage is blocked'))
  const explain = vi.spyOn(ConfiguredContextProvider.prototype, 'explain').mockRejectedValueOnce(new Error('服务暂时不可用')).mockResolvedValue('这里是河岸。')
  await mount(); expect(container.textContent).toContain('本次查询未能保存'); expect(container.textContent).toContain('河岸；银行')
  await click('这里是什么意思'); expect(container.querySelector('[role="alert"]')?.textContent).toContain('服务暂时不可用')
  await click('重试'); expect(explain).toHaveBeenCalledTimes(2); expect(container.textContent).toContain('这里是河岸。')
})
it('cancels and clears cached explanations when service settings change', async () => {
  saveAISettings({ protocol: 'compatible', baseUrl: 'https://example.com', model: 'reader' }, 'test-only')
  const pending = deferred<string>(), explain = vi.spyOn(ConfiguredContextProvider.prototype, 'explain').mockReturnValue(pending.promise)
  await mount(); await click('这里是什么意思')
  await act(async () => window.dispatchEvent(new Event('learning-settings-changed')))
  expect(explain.mock.calls[0][2].aborted).toBe(true)
  await act(async () => pending.resolve('OLD SERVICE'))
  expect(container.textContent).not.toContain('OLD SERVICE')
})
