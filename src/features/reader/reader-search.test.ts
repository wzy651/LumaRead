import { describe, expect, it } from 'vitest'
import type { DocumentSection } from '../../domain/documents'
import { createReaderSearchIndex, createReaderSearchIndexAsync, hasSearchableText, searchReaderIndex, searchReaderIndexAsync, searchReaderSections } from './reader-search'

const sections: DocumentSection[] = [
  { id: 'chapter-1', title: 'The First Chapter', order: 0, blocks: [{ id: 'paragraph', type: 'paragraph', text: 'Hello   WORLD. Hello world again — 中文。', order: 0 }] },
  { id: 'chapter-2', title: 'The Second Chapter', order: 1, blocks: [{ id: 'paragraph', type: 'paragraph', text: 'A phrase across one block: quiet   morning.', order: 0 }] },
]

describe('reader search', () => {
  it('matches case-insensitively, normalizes whitespace, and keeps original offsets', () => {
    const response = searchReaderSections({ resourceKey: 'imported:book', sections }, '  world  ')
    expect(response.totalMatches).toBe(2)
    expect(response.results[0]).toMatchObject({ sectionLabel: 'The First Chapter', matchStart: 8, matchEnd: 13, locator: { kind: 'reflowable', sectionId: 'chapter-1', blockId: 'paragraph', textOffset: 8 } })
    expect(response.results[0].excerpt).toContain('WORLD')
  })

  it('supports phrases, Unicode, and multiple matches in one block', () => {
    const index = createReaderSearchIndex({ resourceKey: 'imported:book', sections })
    expect(searchReaderIndex(index, 'quiet morning').totalMatches).toBe(1)
    expect(searchReaderIndex(index, '中文').totalMatches).toBe(1)
    expect(searchReaderIndex(index, 'hello').totalMatches).toBe(2)
  })

  it('returns PDF page locators and preserves a real total when truncated', () => {
    const many: DocumentSection[] = [{ id: 'page-1', order: 0, blocks: Array.from({ length: 105 }, (_, order) => ({ id: `p-${order}`, type: 'paragraph' as const, text: 'needle', order })) }]
    const response = searchReaderSections({ resourceKey: 'imported:pdf', sections: many, kind: 'pdf' }, 'needle')
    expect(response.results).toHaveLength(100)
    expect(response.totalMatches).toBe(105)
    expect(response.truncated).toBe(true)
    expect(response.results[0].locator).toEqual({ version: 1, kind: 'pdf', resourceKey: 'imported:pdf', pageNumber: 1 })
  })

  it('treats readable blocks as searchable even when stored capability is false', () => {
    expect(hasSearchableText(sections)).toBe(true)
    expect(hasSearchableText([{ blocks: [] }])).toBe(false)
    expect(searchReaderSections({ resourceKey: 'imported:legacy', sections }, 'hello').totalMatches).toBe(2)
  })

  it('does not run a broad search for empty or one-character queries', () => {
    const index = createReaderSearchIndex({ resourceKey: 'imported:book', sections })
    expect(searchReaderIndex(index, '').results).toEqual([])
    expect(searchReaderIndex(index, 'a').totalMatches).toBe(0)
  })

  it('maps whitespace, full-width text, compatibility characters, accents, and CJK to UTF-16 offsets', () => {
    const unicodeSections: DocumentSection[] = [{ id: 'unicode', order: 0, blocks: [
      { id: 'spaces', type: 'paragraph', text: 'prefix one \n\t two suffix', order: 0 },
      { id: 'full-width', type: 'paragraph', text: 'ＨＥＬＬＯ 中文', order: 1 },
      { id: 'compatibility', type: 'paragraph', text: 'ﬀ ligature', order: 2 },
      { id: 'accent', type: 'paragraph', text: 'CAFÉ déjà', order: 3 },
    ] }]
    const index = createReaderSearchIndex({ resourceKey: 'imported:unicode', sections: unicodeSections })
    const whitespace = searchReaderIndex(index, 'one two').results[0]
    expect(whitespace).toMatchObject({ matchStart: 7, matchEnd: 17, locator: { textOffset: 7 } })
    expect(whitespace.blockText.slice(whitespace.matchStart, whitespace.matchEnd)).toBe('one \n\t two')
    expect(searchReaderIndex(index, 'hello').results[0]).toMatchObject({ matchStart: 0, matchEnd: 5 })
    expect(searchReaderIndex(index, 'ff').results.find((result) => result.blockText.includes('ﬀ'))).toMatchObject({ matchStart: 0, matchEnd: 1 })
    expect(searchReaderIndex(index, 'café').totalMatches).toBe(1)
    expect(searchReaderIndex(index, '中文').totalMatches).toBe(1)
  })

  it('keeps emoji surrogate pairs intact in excerpts and highlights block edges', () => {
    const text = `${'a'.repeat(19)}😀${'a'.repeat(71)}needle`
    const sections: DocumentSection[] = [{ id: 'emoji', order: 0, blocks: [{ id: 'p', type: 'paragraph', text, order: 0 }] }]
    const result = searchReaderSections({ resourceKey: 'imported:emoji', sections }, 'needle').results[0]
    expect(result).toMatchObject({ matchStart: 92, matchEnd: 98 })
    expect(result.excerpt).toContain('😀')
    expect([...result.excerpt].join('')).toBe(result.excerpt)

    const edges = searchReaderSections({ resourceKey: 'imported:edges', sections: [{ id: 'edges', order: 0, blocks: [{ id: 'p', type: 'paragraph', text: 'needle at the beginning and needle', order: 0 }] }] }, 'needle')
    expect(edges.results[0].excerptMatchStart).toBe(0)
    expect(edges.results.at(-1)?.excerptMatchEnd).toBe(edges.results.at(-1)?.excerpt.length)
  })

  it('builds and searches a large document in cancellable event-loop batches', async () => {
    const sections: DocumentSection[] = [{ id: 'large', order: 0, blocks: Array.from({ length: 20_000 }, (_, order) => ({ id: `p-${order}`, type: 'paragraph' as const, text: `${'lorem ipsum '.repeat(10)} ${order % 101 === 0 ? 'needle' : 'novel'} ${'dolor sit amet '.repeat(8)}`, order })) }]
    const index = await createReaderSearchIndexAsync({ resourceKey: 'imported:large', sections }, { batchSize: 1024 })
    const response = await searchReaderIndexAsync(index, 'needle', 100, { batchSize: 1024 })
    expect(index).toHaveLength(20_000)
    expect(response.totalMatches).toBeGreaterThan(100)
    expect(response.results).toHaveLength(100)
  })

  it('rejects a stale query after cancellation so it cannot publish over a newer query', async () => {
    const sections: DocumentSection[] = [{ id: 'large', order: 0, blocks: Array.from({ length: 2_000 }, (_, order) => ({ id: `p-${order}`, type: 'paragraph' as const, text: 'needle novel', order })) }]
    const index = createReaderSearchIndex({ resourceKey: 'imported:large', sections })
    const staleController = new AbortController()
    const stale = searchReaderIndexAsync(index, 'needle', 100, { batchSize: 1, signal: staleController.signal })
    const staleRejected = expect(stale).rejects.toMatchObject({ name: 'AbortError' })
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
    staleController.abort()
    const fresh = await searchReaderIndexAsync(index, 'novel', 100, { batchSize: 256 })
    await staleRejected
    expect(fresh.query).toBe('novel')
    expect(fresh.results[0].blockText).toContain('novel')
  })
})
