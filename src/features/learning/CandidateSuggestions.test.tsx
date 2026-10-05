// @vitest-environment jsdom
import { act, StrictMode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ThemeProvider } from '../../app/providers/ThemeProvider'
import { StatisticsPage } from './StatisticsPage'
import { SessionSummaryPage } from '../session-summary/SessionSummaryPage'
import * as repository from './repository'
import { readLearningData } from './statistics'
import { saveReadingSession } from './reading-sessions'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
let container: HTMLDivElement, root: Root
const now = new Date('2026-10-05T12:00:00.000Z')
const excerpt = { text: 'bank', sentence: 'She sat on the bank.', resourceKey: 'imported:one', bookTitle: 'One' }
beforeEach(() => {
  vi.stubGlobal('indexedDB', new IDBFactory()); localStorage.clear(); localStorage.setItem('lumaread-theme', 'light')
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(now)
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
})
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
async function seed(text = 'bank', changes = {}) { await repository.recordLookup({ ...excerpt, text, ...changes }); await repository.recordLookup({ ...excerpt, text, ...changes }) }
async function mount(summary = false) {
  await act(async () => root.render(<StrictMode><MemoryRouter><ThemeProvider>{summary ? <SessionSummaryPage /> : <StatisticsPage />}</ThemeProvider></MemoryRouter></StrictMode>))
  await settle(() => expect(container.textContent).not.toMatch(/正在读取本机记录|正在整理本机记录/))
}
async function settle(assertion: () => void) { await vi.waitFor(async () => { await act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)) }); assertion() }) }
function candidates() { return container.querySelector('.learning-candidates') }
function terms() { return Array.from(candidates()?.querySelectorAll('li strong') ?? []).map((item) => item.textContent) }
async function click(button: HTMLButtonElement) { await act(async () => button.click()) }

describe('candidate surfaces use real persisted learning data', () => {
  it('shows reasons without enrolling, and ignoring then reopening does not exclude', async () => {
    await seed(); const before = await readLearningData()
    await mount()
    expect(candidates()?.textContent).toContain('近 30 天查询 2 次')
    expect(terms()).toEqual(['bank'])
    expect(await readLearningData()).toEqual(before)
    await act(async () => root.render(null)); await mount()
    expect(terms()).toEqual(['bank'])
    expect((await readLearningData()).reviewCardKeys).toEqual([])
  })

  it('keeps five rows stable after acceptance, refresh and the statistics period toggle', async () => {
    for (let i = 0; i < 6; i++) await seed(`word${i}`)
    await mount(); expect(terms()).toEqual(['word0', 'word1', 'word2', 'word3', 'word4'])
    await click(candidates()!.querySelector('button')!)
    await settle(() => expect(candidates()?.textContent).toContain('已加入学习'))
    const data = await readLearningData()
    expect(data.terms.find((item) => item.normalized === 'word0')?.status).toBe('learning')
    expect(data.reviewCardKeys).toEqual([]); expect(data.reviews).toEqual([])
    const all = Array.from(container.querySelectorAll('button')).find((item) => item.textContent === '全部记录')!
    await click(all)
    expect(terms()).toEqual(['word0', 'word1', 'word2', 'word3', 'word4'])
    expect(candidates()?.textContent).not.toContain('word5')
    await settle(() => expect(Array.from(container.querySelectorAll('button')).some((item) => item.textContent === '移出学习')).toBe(true))
    await click(Array.from(container.querySelectorAll('button')).find((item) => item.textContent === '移出学习')!)
    await settle(() => expect(candidates()?.textContent).toContain('状态已更新'))
    expect((await readLearningData()).terms.find((item) => item.normalized === 'word0')?.candidateExcluded).toBe(true)
    expect(terms()).toEqual(['word0', 'word1', 'word2', 'word3', 'word4'])
  })

  it('shows only session expressions with that session context, even when the latest example is elsewhere', async () => {
    vi.setSystemTime(new Date('2026-10-05T10:00:00.000Z')); await seed()
    await saveReadingSession({ id: 'ended', resourceKey: excerpt.resourceKey, bookTitle: 'One', startedAt: '2026-10-05T09:00:00.000Z', updatedAt: '2026-10-05T11:00:00.000Z', endedAt: '2026-10-05T11:00:00.000Z', activeMs: 60000 })
    vi.setSystemTime(now); await seed('bank', { resourceKey: 'imported:two', bookTitle: 'Two', sentence: 'The bank was closed.' }); await seed('river', { resourceKey: 'imported:two', bookTitle: 'Two' })
    await mount(true)
    expect(terms()).toEqual(['bank'])
    expect(candidates()?.textContent).toContain('She sat on the bank.')
    expect(candidates()?.textContent).not.toContain('The bank was closed.')
    await click(candidates()!.querySelector('button')!)
    await settle(() => expect(candidates()?.textContent).toContain('已加入学习'))
    const data = await readLearningData()
    expect(data.terms.find((item) => item.normalized === 'bank')?.example.sentence).toBe('The bank was closed.')
    expect(data.reviewCardKeys).toEqual([])
  })

  it('does not substitute global suggestions without an ended session; timing off still allows statistics', async () => {
    await seed(); localStorage.setItem('lumaread-reading-time:v1', 'off')
    await mount(true); expect(candidates()).toBeNull()
    expect(container.textContent).toContain('暂时没有计时记录')
    await act(async () => root.render(null)); await mount()
    expect(terms()).toEqual(['bank'])
  })

  it('handles a stale acceptance without overwriting a newer known status', async () => {
    await seed(); await mount(); await repository.setLearningStatus('bank', 'recognized')
    await click(candidates()!.querySelector('button')!)
    await settle(() => expect(candidates()?.textContent).toContain('状态已更新'))
    expect((await readLearningData()).terms[0].status).toBe('recognized')
    expect((await readLearningData()).reviewCardKeys).toEqual([])
  })

  it('retains a retry after failed storage and never claims it was added before commit', async () => {
    await seed(); await mount()
    const put = IDBObjectStore.prototype.put
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, ...args: Parameters<typeof put>) { const request = put.apply(this, args); this.transaction.abort(); return request })
    await click(candidates()!.querySelector('button')!)
    await settle(() => expect(candidates()?.querySelector('[role="alert"]')).not.toBeNull())
    expect(candidates()?.textContent).not.toContain('已加入学习')
    expect((await readLearningData()).terms[0].status).toBe('unknown')
    vi.restoreAllMocks()
    await click(candidates()!.querySelector('button')!)
    await settle(() => expect(candidates()?.textContent).toContain('已加入学习'))
  })

  it('prevents rapid duplicate acceptance and ignores late UI updates after unmount', async () => {
    await seed(); await mount()
    let release!: () => void
    const gate = new Promise<void>((resolve) => { release = resolve }), original = repository.acceptLearningCandidate
    const acceptance = vi.spyOn(repository, 'acceptLearningCandidate').mockImplementation(async (normalized) => { await gate; return original(normalized) })
    const button = candidates()!.querySelector('button')!
    await act(async () => { button.click(); button.click() })
    expect(button.disabled).toBe(true); expect(button.textContent).not.toBe('已加入学习')
    await act(async () => root.render(null))
    release()
    await act(async () => { await acceptance.mock.results[0].value })
    expect(acceptance).toHaveBeenCalledTimes(1)
    expect(container.textContent).toBe('')
    expect((await readLearningData()).terms[0].status).toBe('learning')
  })

  it.each([false, true])('shows an honest read failure with a working retry, summary=%s', async (summary) => {
    await seed()
    await saveReadingSession({ id: 'ended', resourceKey: excerpt.resourceKey, bookTitle: 'One', startedAt: '2026-10-05T11:00:00.000Z', updatedAt: '2026-10-05T12:01:00.000Z', endedAt: '2026-10-05T12:01:00.000Z', activeMs: 60000 })
    vi.spyOn(indexedDB, 'open').mockImplementation(() => { throw new Error('storage unavailable') })
    await mount(summary)
    expect(container.textContent).toContain('暂时无法读取')
    expect(candidates()).toBeNull()
    expect(container.querySelector('a[href="/"]')).not.toBeNull()
    vi.restoreAllMocks()
    await click(Array.from(container.querySelectorAll('button')).find((item) => item.textContent === '重试')!)
    await settle(() => expect(terms()).toEqual(['bank']))
    expect(container.textContent).not.toContain('暂时无法读取')
    expect((await readLearningData()).terms[0].status).toBe('unknown')
    expect((await readLearningData()).reviewCardKeys).toEqual([])
  })
})
