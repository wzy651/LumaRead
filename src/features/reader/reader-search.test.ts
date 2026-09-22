import { describe, expect, it } from 'vitest'
import type { DocumentSection } from '../../domain/documents'
import { createReaderSearchIndex, hasSearchableText, searchReaderIndex, searchReaderSections } from './reader-search'

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
})
