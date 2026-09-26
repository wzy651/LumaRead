// @vitest-environment jsdom
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { IDBFactory } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { lookupDictionary, normalizeTerm } from './dictionary'
import { contextEndpoint, readAISettings, saveAISettings, getSessionKey, clearSessionKey } from './settings'
import { ConfiguredContextProvider, contextMessages, extractAnswer } from './context-provider'
import { recordLookup, recentLookups, setLearningStatus } from './repository'
import { contextAtAnchor, sentenceAround, wordAtOffset } from './selection'
import type { ReadingExcerpt } from './types'

const excerpt: ReadingExcerpt = { resourceKey: 'imported:one', bookTitle: 'A quiet story', sectionId: 'chapter-1', blockId: 'paragraph-1', text: 'bank', sentence: 'She sat on the bank of the river.' }
beforeEach(() => { localStorage.clear(); clearSessionKey(); vi.stubGlobal('indexedDB', new IDBFactory()) })
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('offline reading dictionary', () => {
  it('loads real bundled entries, including a lemma, without a network service', async () => {
    const fetcher = vi.fn(async (url: string) => { try { return new Response(await readFile(resolve(process.cwd(), 'public', url.replace(/^\//, '')), 'utf8')) } catch { return new Response('{}', { status: 404 }) } })
    vi.stubGlobal('fetch', fetcher)
    expect((await lookupDictionary('bank'))?.translation).toContain('银行')
    expect((await lookupDictionary('reluctantly'))?.translation).toMatch(/不情愿|勉强/)
    expect(await lookupDictionary('went')).toBeDefined()
    expect(await lookupDictionary('xyznotawordxx')).toBeUndefined()
    expect(await lookupDictionary('../../private')).toBeUndefined()
    expect(fetcher.mock.calls.every(([url]) => url.startsWith('/dictionary/'))).toBe(true)
  })
  it('normalizes punctuation and preserves lexical boundaries', () => {
    expect(normalizeTerm('  Don’t   Give Up ')).toBe("don't give up")
    expect(wordAtOffset('😀 Don’t give up.', 6)?.text).toBe('Don’t')
    expect(sentenceAround('The night was cold. She sat on the bank of the river. Then she left.', 36, 40)).toBe('She sat on the bank of the river.')
  })
  it('reconstructs PDF context across separate TextLayer word spans', () => {
    const layer = document.createElement('div'); layer.className = 'pdf-text-layer'
    for (const word of 'She sat on the bank of the river.'.split(' ')) { const span = document.createElement('span'); span.textContent = word; layer.append(span) }
    expect(contextAtAnchor(layer.children[4] as HTMLElement, 0, 4)).toBe('She sat on the bank of the river.')
  })
})

describe('reading records do not create review obligations', () => {
  it('records source and context while remaining unknown until explicitly added', async () => {
    const first = await recordLookup(excerpt)
    expect(first.term.status).toBe('unknown'); expect(first.previous).toBeUndefined()
    await setLearningStatus('BANK', 'learning')
    const second = await recordLookup({ ...excerpt, resourceKey: 'imported:two', sentence: 'She went to the bank.' })
    expect(second.term.status).toBe('learning'); expect(second.term.lookups).toBe(2)
    expect(second.previous?.sentence).toBe(excerpt.sentence)
    const history = await recentLookups(); expect(history).toHaveLength(2); expect(history[0].resourceKey).toBe('imported:two')
    await setLearningStatus('bank', 'unknown'); expect((await recordLookup(excerpt)).term.status).toBe('unknown')
  })
  it('serializes simultaneous updates without losing lookups', async () => {
    const results = await Promise.all(Array.from({ length: 8 }, () => recordLookup(excerpt)))
    expect(results.map((item) => item.term.lookups).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect(await recentLookups()).toHaveLength(8)
  })
})

describe('explicit, bounded model requests', () => {
  it('persists only safe settings and keeps API keys in memory', () => {
    saveAISettings({ protocol: 'compatible', baseUrl: 'https://example.com/v1/', model: 'reader-model' }, 'test-only-key')
    expect(getSessionKey()).toBe('test-only-key'); expect(JSON.stringify(localStorage)).not.toContain('test-only-key')
    expect(contextEndpoint(readAISettings())).toBe('https://example.com/v1/chat/completions')
    clearSessionKey(); expect(getSessionKey()).toBe('')
  })
  it('rejects unsafe addresses and accepts local model endpoints', () => {
    for (const baseUrl of ['http://example.com', 'javascript:alert(1)', 'https://key:password@example.com', 'https://example.com?key=secret']) expect(() => contextEndpoint({ protocol: 'compatible', model: 'x', baseUrl })).toThrow()
    expect(contextEndpoint({ protocol: 'ollama', model: 'local', baseUrl: 'http://localhost:11434' })).toBe('http://localhost:11434/api/chat')
  })
  it('does not send anything without configuration', async () => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher)
    await expect(new ConfiguredContextProvider().explain(excerpt, 'context', new AbortController().signal)).rejects.toThrow('设置')
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('sends only a bounded excerpt, keeps book text out of instructions and decodes the result', async () => {
    saveAISettings({ protocol: 'compatible', baseUrl: 'https://example.com/v1', model: 'reader' }, 'test-key')
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: '这里 bank 指河岸。' } }] })))
    vi.stubGlobal('fetch', fetcher)
    const result = await new ConfiguredContextProvider().explain(excerpt, 'context', new AbortController().signal)
    expect(result).toBe('这里 bank 指河岸。')
    const body = JSON.parse(fetcher.mock.calls[0][1].body)
    expect(body.messages[0].content).not.toContain(excerpt.sentence)
    expect(body.messages[1].content).not.toContain(excerpt.bookTitle)
    expect(body.messages[1].content).toContain(excerpt.sentence)
    expect(contextMessages({ ...excerpt, text: 'x'.repeat(2000), sentence: 'y'.repeat(3000) }, 'simplify')[1].content.length).toBeLessThan(2300)
  })
  it('handles malformed answers, authentication errors and user cancellation', async () => {
    expect(() => extractAnswer({ choices: [] }, 'compatible')).toThrow()
    expect(extractAnswer({ message: { content: 'Simple sentence.' } }, 'ollama')).toBe('Simple sentence.')
    saveAISettings({ protocol: 'compatible', baseUrl: 'https://example.com', model: 'reader' }, 'test-key')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('secret server details', { status: 401 })))
    await expect(new ConfiguredContextProvider().explain(excerpt, 'context', new AbortController().signal)).rejects.toThrow('凭据')
    const controller = new AbortController(); controller.abort()
    await expect(new ConfiguredContextProvider().explain(excerpt, 'context', controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
  })
  it('does not forward a cloud API key to an Ollama endpoint', async () => {
    saveAISettings({ protocol: 'ollama', baseUrl: 'http://localhost:11434', model: 'local-reader' }, 'cloud-key')
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: { content: 'The riverside.' } })))
    vi.stubGlobal('fetch', fetcher)
    await new ConfiguredContextProvider().explain(excerpt, 'simplify', new AbortController().signal)
    expect(fetcher.mock.calls[0][1].headers).not.toHaveProperty('Authorization')
  })
})
