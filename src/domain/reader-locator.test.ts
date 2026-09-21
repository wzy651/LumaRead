import { describe, expect, it } from 'vitest'
import { createAnchorKey, deserializeReaderLocator, normalizeReaderLocator, resolveReaderLocator, serializeReaderLocator } from './reader-locator'

const reflowable = { version: 1 as const, kind: 'reflowable' as const, resourceKey: 'imported:book', sectionId: 'chapter-2', sectionIndex: 1, blockId: 'paragraph-4', progression: 0.4 }

describe('ReaderLocator', () => {
  it('validates, normalizes, serializes, and produces stable anchor keys', () => {
    expect(normalizeReaderLocator({ ...reflowable, sectionIndex: 1.4, progression: 2 })).toMatchObject({ sectionIndex: 1, progression: 1 })
    const serialized = serializeReaderLocator(reflowable)
    expect(deserializeReaderLocator(serialized)).toEqual(reflowable)
    expect(createAnchorKey({ ...reflowable })).toBe(createAnchorKey({ ...reflowable }))
    expect(normalizeReaderLocator({ kind: 'pdf', version: 1, resourceKey: 'bad', pageNumber: 1 })).toBeUndefined()
  })

  it('falls back from stale block and section to a safe section or first PDF page', () => {
    const sections = [{ id: 'chapter-1', blocks: [{ id: 'paragraph-1', type: 'paragraph' as const, text: '', order: 0 }] }, { id: 'chapter-2', blocks: [{ id: 'paragraph-2', type: 'paragraph' as const, text: '', order: 0 }] }]
    expect(resolveReaderLocator({ ...reflowable, blockId: 'gone' }, { resourceKey: 'imported:book', sections })).toMatchObject({ sectionIndex: 1, locator: { sectionId: 'chapter-2' }, usedFallback: true })
    expect(resolveReaderLocator({ ...reflowable, sectionId: 'gone', sectionIndex: 99 }, { resourceKey: 'imported:book', sections })).toMatchObject({ sectionIndex: 1, locator: { sectionId: 'chapter-2' }, usedFallback: true })
    expect(resolveReaderLocator({ version: 1, kind: 'pdf', resourceKey: 'imported:book', pageNumber: 99 }, { resourceKey: 'imported:book', pageCount: 3 })).toMatchObject({ pageNumber: 1, usedFallback: true })
  })
})
