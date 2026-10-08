// @vitest-environment jsdom
import { act, StrictMode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ThemeProvider } from '../../app/providers/ThemeProvider'
import { LookupContent } from './LookupContent'
import { StatisticsPage } from './StatisticsPage'
import { SessionSummaryPage } from '../session-summary/SessionSummaryPage'
import { QuickReviewPage } from '../review/QuickReviewPage'
import { learningTransaction, recordLookup, updateVocabularyState } from './repository'
import { getVocabularyState } from './vocabulary-state'
import { readLearningData } from './statistics'
import { getReviewQueue } from '../review/review-service'
import type { LearningTerm, VocabularyAction } from './types'

vi.mock('./dictionary', async (original) => ({ ...await original<typeof import('./dictionary')>(), lookupDictionary: async () => ({ word: 'bank', translation: '河岸；银行', definition: 'river bank', phonetic: '', source: 'ECDICT' as const }) }))
;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
const excerpt = { text: 'bank', sentence: 'She sat on the bank.', resourceKey: 'one', bookTitle: 'One' }
let container: HTMLDivElement, root: Root
beforeEach(() => { vi.stubGlobal('indexedDB', new IDBFactory()); localStorage.clear(); localStorage.setItem('lumaread-theme', 'light'); container = document.createElement('div'); document.body.append(container); root = createRoot(container) })
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
async function mount(page: 'lookup' | 'stats' | 'summary' | 'review' = 'lookup', close = vi.fn()) {
  await act(async () => root.render(<StrictMode><MemoryRouter><ThemeProvider>{page === 'lookup' ? <LookupContent excerpt={excerpt} onClose={close} onSettings={vi.fn()} /> : page === 'stats' ? <StatisticsPage /> : page === 'summary' ? <SessionSummaryPage /> : <QuickReviewPage />}</ThemeProvider></MemoryRouter></StrictMode>))
  await settle(() => expect(container.textContent).not.toMatch(/正在读取本机记录|正在整理本机记录|正在读取本地词义|正在挑选适合回想/))
  // Offline dictionary completion does not imply that the separate IndexedDB transaction committed.
  if (page === 'lookup') await settle(() => expect(container.querySelector('.vocabulary-details') !== null || container.textContent?.includes('本次查询未能保存')).toBe(true))
}
async function settle(check: () => void) { await vi.waitFor(async () => { await act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)) }); check() }) }
async function click(label: string, scope: Element = container) {
  const button = Array.from(scope.querySelectorAll('button')).find((item) => item.textContent === label)
  expect(button, label).toBeDefined(); await act(async () => button!.click())
}
async function stored() { return (await readLearningData()).terms[0] }
async function change(action: VocabularyAction) { const term = await stored(); await updateVocabularyState(term.normalized, action, getVocabularyState(term)!.revision) }
async function put(term: LearningTerm) { await learningTransaction(['terms'], 'readwrite', (tx, finish) => { tx.objectStore('terms').put(term); finish(undefined) }) }

it('keeps ability inside collapsed details; understanding and lookup do not assess ability', async () => {
  const close = vi.fn(); await mount('lookup', close)
  const details = container.querySelector<HTMLDetailsElement>('.vocabulary-details')
  expect(details).not.toBeNull(); expect(details!.open).toBe(false)
  expect(details!.textContent).toContain('我的判断'); expect(details!.textContent).toContain('会使用')
  const before = await readLearningData()
  await click('懂了，继续读'); expect(close).toHaveBeenCalledOnce()
  expect(await readLearningData()).toEqual(before)
  expect(getVocabularyState(await stored())).toMatchObject({ proficiency: 'unknown', learningEnabled: false })
})

it.each(['recognized', 'active'] as const)('lookup enrollment/removal preserves %s and persists consistent mirrors', async (proficiency) => {
  await recordLookup(excerpt); await change({ type: 'assess', level: proficiency })
  await mount(); await click('加入学习')
  await settle(() => expect(container.querySelector('.lookup-content > .learning-actions')?.textContent).toContain('移出学习'))
  expect(await stored()).toMatchObject({ status: 'learning', vocabularyState: { proficiency, learningEnabled: true } })
  await click('移出学习')
  await settle(() => expect(container.querySelector('.lookup-content > .learning-actions')?.textContent).toContain('加入学习'))
  expect(await stored()).toMatchObject({ status: proficiency, candidateExcluded: true, vocabularyState: { proficiency, learningEnabled: false } })
})

it('self assessment stays optional and does not enroll, change exclusion or create a card', async () => {
  await recordLookup(excerpt); await change({ type: 'unenroll' }); await mount()
  const details = container.querySelector<HTMLDetailsElement>('.vocabulary-details')!; details.open = true
  await click('写作或口语中会使用', details)
  await settle(() => expect(details.textContent).toContain('自我判断'))
  expect(await stored()).toMatchObject({ status: 'active', candidateExcluded: true, vocabularyState: { proficiency: 'active', learningEnabled: false, basis: 'self' } })
  expect((await readLearningData()).reviewCardKeys).toEqual([])
  expect((await readLearningData()).reviews).toEqual([])
})

it('an old lookup action is stale, refreshes state and never replays enrollment', async () => {
  await mount(); await change({ type: 'assess', level: 'recognized' })
  await click('加入学习')
  await settle(() => expect(container.textContent).toContain('本次操作未保存'))
  expect(await stored()).toMatchObject({ status: 'recognized', vocabularyState: { proficiency: 'recognized', learningEnabled: false } })
  expect(container.querySelector('.lookup-content > .learning-actions')?.textContent).toContain('加入学习')
})

it('failed lookup state writes retain the old state and can be retried', async () => {
  await mount(); const before = await readLearningData(), putRequest = IDBObjectStore.prototype.put
  vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, ...args: Parameters<typeof putRequest>) { const result = putRequest.apply(this, args); this.transaction.abort(); return result })
  await click('加入学习')
  await settle(() => expect(container.textContent).toContain('暂时无法保存'))
  expect(await readLearningData()).toEqual(before)
  vi.restoreAllMocks(); await click('加入学习')
  await settle(() => expect(container.querySelector('.lookup-content > .learning-actions')?.textContent).toContain('移出学习'))
})

it('statistics uses the new state and provides historical expression details without creating lookups', async () => {
  await recordLookup(excerpt); await change({ type: 'assess', level: 'active' }); await change({ type: 'enroll' })
  await put({ ...await stored(), status: 'unknown' })
  const before = await readLearningData(); await mount('stats')
  expect(container.textContent).toContain('阅读时已认识 · 暂停复习')
  const records = container.querySelector<HTMLDetailsElement>('.vocabulary-records')!
  expect(records).not.toBeNull(); expect(records.open).toBe(false); records.open = true
  expect(records.querySelector('.vocabulary-details')?.textContent).toContain('会使用')
  expect(await readLearningData()).toEqual(before)
  await click('移出学习', container.querySelector('.selected-learning')!)
  await settle(() => expect(container.querySelector('.selected-learning')?.textContent).not.toContain('暂停复习'))
  expect(await stored()).toMatchObject({ status: 'active', vocabularyState: { proficiency: 'active', learningEnabled: false } })
})

it('summary review entry follows new state rather than its mirror', async () => {
  await recordLookup(excerpt); await put({ ...await stored(), status: 'learning' })
  await mount('summary'); expect(container.querySelector('a[href="/review"]')).toBeNull()
  await act(async () => root.render(null)); await change({ type: 'enroll' }); await put({ ...await stored(), status: 'unknown' })
  await mount('summary'); expect(container.querySelector('a[href="/review"]')).not.toBeNull()
})

it('old review feedback after removal is visibly stale and never creates a log', async () => {
  await recordLookup(excerpt); await change({ type: 'enroll' }); await mount('review')
  await click('看看答案'); await change({ type: 'unenroll' }); await click('想起来了')
  await settle(() => expect(container.textContent).toContain('本次反馈未保存'))
  expect((await readLearningData()).reviews).toEqual([])
})

it('damaged stored state leaves dictionary and reading exit available', async () => {
  await recordLookup(excerpt); const term = await stored()
  await put({ ...term, status: 'learning', vocabularyState: { revision: -1 } } as LearningTerm)
  await mount()
  expect(container.textContent).toContain('河岸'); expect(container.textContent).toContain('懂了，继续读')
  expect(container.querySelector('.vocabulary-details')).toBeNull()
  expect(await stored()).toMatchObject({ vocabularyState: { revision: -1 } })
  expect((await getReviewQueue()).hasUnreadableRecords).toBe(true)
})
