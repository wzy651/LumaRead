import type { DocumentBlock, DocumentSection } from '../../domain/documents'
import type { ReaderLocator } from '../../domain/reader-locator'

export const readerSearchResultLimit = 100

export type ReaderSearchKind = 'reflowable' | 'pdf'

export interface ReaderSearchIndexBlock {
  resourceKey: string
  kind: ReaderSearchKind
  sectionId: string
  sectionIndex: number
  sectionLabel: string
  blockId: string
  text: string
  normalizedText: string
  normalizedToOriginal: number[]
}

export interface ReaderSearchResult {
  id: string
  resourceKey: string
  locator: ReaderLocator
  sectionLabel: string
  excerpt: string
  matchStart: number
  matchEnd: number
  excerptMatchStart: number
  excerptMatchEnd: number
  blockText: string
}

export interface ReaderSearchResponse {
  query: string
  totalMatches: number
  truncated: boolean
  results: ReaderSearchResult[]
}

export interface ReaderSearchIndexOptions {
  resourceKey: string
  sections: Pick<DocumentSection, 'id' | 'title' | 'order' | 'blocks'>[]
  kind?: ReaderSearchKind
}

function normalizedCharacter(value: string) {
  return value.normalize('NFKC').toLocaleLowerCase()
}

/** Normalizes user-visible search text without losing the original UTF-16 offsets. */
export function normalizeSearchText(value: string): string {
  let normalized = ''
  let previousWasWhitespace = false
  for (const character of value) {
    if (/\s/u.test(character)) {
      if (!previousWasWhitespace) normalized += ' '
      previousWasWhitespace = true
      continue
    }
    normalized += normalizedCharacter(character)
    previousWasWhitespace = false
  }
  return normalized.trim()
}

function normalizeWithOffsets(value: string) {
  let normalized = ''
  const starts: number[] = []
  const ends: number[] = []
  let previousWasWhitespace = false
  let originalOffset = 0

  for (const character of value) {
    const start = originalOffset
    originalOffset += character.length
    if (/\s/u.test(character)) {
      if (!previousWasWhitespace) {
        normalized += ' '
        starts.push(start)
        ends.push(originalOffset)
      }
      ends[ends.length - 1] = originalOffset
      previousWasWhitespace = true
      continue
    }
    const expanded = normalizedCharacter(character)
    for (const expandedCharacter of expanded) {
      normalized += expandedCharacter
      for (let unit = 0; unit < expandedCharacter.length; unit += 1) {
        starts.push(start)
        ends.push(originalOffset)
      }
    }
    previousWasWhitespace = false
  }

  let trimStart = 0
  let trimEnd = normalized.length
  while (trimStart < trimEnd && normalized[trimStart] === ' ') trimStart += 1
  while (trimEnd > trimStart && normalized[trimEnd - 1] === ' ') trimEnd -= 1
  return {
    text: normalized.slice(trimStart, trimEnd),
    starts: starts.slice(trimStart, trimEnd),
    ends: ends.slice(trimStart, trimEnd),
  }
}

function blockIsSearchable(block: DocumentBlock) {
  return block.type !== 'page-break' && Boolean(block.text.trim())
}

export function hasSearchableText(sections: Pick<DocumentSection, 'blocks'>[]) {
  return sections.some((section) => section.blocks.some(blockIsSearchable))
}

export function createReaderSearchIndex({ resourceKey, sections, kind = 'reflowable' }: ReaderSearchIndexOptions): ReaderSearchIndexBlock[] {
  const blocks: ReaderSearchIndexBlock[] = []
  sections.forEach((section, sectionIndex) => {
    section.blocks.forEach((block) => {
      if (!blockIsSearchable(block)) return
      const mapped = normalizeWithOffsets(block.text)
      if (!mapped.text) return
      blocks.push({
        resourceKey,
        kind,
        sectionId: section.id,
        sectionIndex,
        sectionLabel: kind === 'pdf' ? `Page ${sectionIndex + 1}` : section.title ?? `Section ${sectionIndex + 1}`,
        blockId: block.id,
        text: block.text,
        normalizedText: mapped.text,
        normalizedToOriginal: mapped.starts.flatMap((start, index) => [start, mapped.ends[index] ?? start]),
      })
    })
  })
  return blocks
}

function excerptFor(text: string, start: number, end: number) {
  const radius = 72
  const excerptStart = Math.max(0, start - radius)
  const excerptEnd = Math.min(text.length, end + radius)
  const prefix = excerptStart > 0 ? '…' : ''
  const suffix = excerptEnd < text.length ? '…' : ''
  return { text: `${prefix}${text.slice(excerptStart, excerptEnd)}${suffix}`, start: start - excerptStart + prefix.length, end: end - excerptStart + prefix.length }
}

function locatorFor(block: ReaderSearchIndexBlock, matchStart: number): ReaderLocator {
  if (block.kind === 'pdf') return { version: 1, kind: 'pdf', resourceKey: block.resourceKey, pageNumber: block.sectionIndex + 1 }
  return { version: 1, kind: 'reflowable', resourceKey: block.resourceKey, sectionId: block.sectionId, sectionIndex: block.sectionIndex, blockId: block.blockId, textOffset: matchStart }
}

export function searchReaderIndex(index: ReaderSearchIndexBlock[], query: string, limit = readerSearchResultLimit): ReaderSearchResponse {
  const normalizedQuery = normalizeSearchText(query)
  const response: ReaderSearchResponse = { query, totalMatches: 0, truncated: false, results: [] }
  if (!normalizedQuery || normalizedQuery.length < 2) return response

  for (const block of index) {
    let from = 0
    while (from <= block.normalizedText.length - normalizedQuery.length) {
      const match = block.normalizedText.indexOf(normalizedQuery, from)
      if (match < 0) break
      response.totalMatches += 1
      if (response.results.length < limit) {
        const matchStart = block.normalizedToOriginal[match * 2] ?? 0
        const matchEnd = block.normalizedToOriginal[(match + normalizedQuery.length - 1) * 2 + 1] ?? matchStart
        const excerpt = excerptFor(block.text, matchStart, matchEnd)
        response.results.push({
          id: `${block.resourceKey}:${block.sectionId}:${block.blockId}:${matchStart}`,
          resourceKey: block.resourceKey,
          locator: locatorFor(block, matchStart),
          sectionLabel: block.sectionLabel,
          excerpt: excerpt.text,
          matchStart,
          matchEnd,
          excerptMatchStart: excerpt.start,
          excerptMatchEnd: excerpt.end,
          blockText: block.text,
        })
      }
      from = match + Math.max(1, normalizedQuery.length)
    }
  }
  response.truncated = response.totalMatches > response.results.length
  return response
}

export function searchReaderSections(options: ReaderSearchIndexOptions, query: string, limit = readerSearchResultLimit) {
  return searchReaderIndex(createReaderSearchIndex(options), query, limit)
}
