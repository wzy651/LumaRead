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
  offsetMapIsIdentity: boolean
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

export interface ReaderSearchTaskOptions {
  signal?: AbortSignal
  batchSize?: number
}

function normalizedCharacter(value: string) {
  if (value.length === 1) {
    const code = value.charCodeAt(0)
    if (code >= 0x41 && code <= 0x5a) return String.fromCharCode(code + 0x20)
    if (code < 0x80) return value
  }
  return value.normalize('NFKC').toLowerCase()
}

function isSearchWhitespace(value: string) {
  if (value.length === 1) {
    const code = value.charCodeAt(0)
    return code === 0x09 || code === 0x0a || code === 0x0b || code === 0x0c || code === 0x0d || code === 0x20
  }
  return /\s/u.test(value)
}

function canUseIdentityOffsets(value: string) {
  let previousWasWhitespace = false
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    if (code >= 0x80) return false
    const whitespace = code === 0x09 || code === 0x0a || code === 0x0b || code === 0x0c || code === 0x0d || code === 0x20
    if (whitespace && (index === 0 || index === value.length - 1 || previousWasWhitespace)) return false
    previousWasWhitespace = whitespace
  }
  return true
}

/** Normalizes user-visible search text without losing the original UTF-16 offsets. */
export function normalizeSearchText(value: string): string {
  let normalized = ''
  let previousWasWhitespace = false
  for (const character of value) {
    if (isSearchWhitespace(character)) {
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
    if (isSearchWhitespace(character)) {
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

function throwIfAborted(signal?: AbortSignal) {
  if (!signal?.aborted) return
  const error = new Error('Reader search task was cancelled.')
  error.name = 'AbortError'
  throw error
}

function yieldToEventLoop() {
  return new Promise<void>((resolve) => globalThis.setTimeout(resolve, 0))
}

function indexBlock(resourceKey: string, kind: ReaderSearchKind, section: Pick<DocumentSection, 'id' | 'title' | 'blocks'>, sectionIndex: number, block: DocumentBlock): ReaderSearchIndexBlock | undefined {
  if (!blockIsSearchable(block)) return undefined
  if (canUseIdentityOffsets(block.text)) {
    return {
      resourceKey,
      kind,
      sectionId: section.id,
      sectionIndex,
      sectionLabel: kind === 'pdf' ? `Page ${sectionIndex + 1}` : section.title ?? `Section ${sectionIndex + 1}`,
      blockId: block.id,
      text: block.text,
      normalizedText: block.text,
      normalizedToOriginal: [],
      offsetMapIsIdentity: true,
    }
  }
  const mapped = normalizeWithOffsets(block.text)
  if (!mapped.text) return undefined
  return {
    resourceKey,
    kind,
    sectionId: section.id,
    sectionIndex,
    sectionLabel: kind === 'pdf' ? `Page ${sectionIndex + 1}` : section.title ?? `Section ${sectionIndex + 1}`,
    blockId: block.id,
    text: block.text,
    normalizedText: mapped.text,
    normalizedToOriginal: mapped.starts.flatMap((start, index) => [start, mapped.ends[index] ?? start]),
    offsetMapIsIdentity: false,
  }
}

export function hasSearchableText(sections: Pick<DocumentSection, 'blocks'>[]) {
  return sections.some((section) => section.blocks.some(blockIsSearchable))
}

export function createReaderSearchIndex({ resourceKey, sections, kind = 'reflowable' }: ReaderSearchIndexOptions): ReaderSearchIndexBlock[] {
  const blocks: ReaderSearchIndexBlock[] = []
  sections.forEach((section, sectionIndex) => {
    section.blocks.forEach((block) => {
      const indexed = indexBlock(resourceKey, kind, section, sectionIndex, block)
      if (indexed) blocks.push(indexed)
    })
  })
  return blocks
}

export async function createReaderSearchIndexAsync(options: ReaderSearchIndexOptions, taskOptions: ReaderSearchTaskOptions = {}): Promise<ReaderSearchIndexBlock[]> {
  const { resourceKey, sections, kind = 'reflowable' } = options
  const batchSize = Math.max(1, taskOptions.batchSize ?? 1024)
  const blocks: ReaderSearchIndexBlock[] = []
  let processed = 0
  for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex += 1) {
    const section = sections[sectionIndex]
    for (const block of section.blocks) {
      throwIfAborted(taskOptions.signal)
      const indexed = indexBlock(resourceKey, kind, section, sectionIndex, block)
      if (indexed) blocks.push(indexed)
      processed += 1
      if (processed >= batchSize) {
        processed = 0
        await yieldToEventLoop()
      }
    }
  }
  throwIfAborted(taskOptions.signal)
  return blocks
}

function excerptFor(text: string, start: number, end: number) {
  const radius = 72
  let excerptStart = Math.max(0, start - radius)
  let excerptEnd = Math.min(text.length, end + radius)
  if (excerptStart > 0 && isLowSurrogate(text.charCodeAt(excerptStart))) excerptStart -= 1
  if (excerptEnd < text.length && isHighSurrogate(text.charCodeAt(excerptEnd - 1)) && isLowSurrogate(text.charCodeAt(excerptEnd))) excerptEnd += 1
  const prefix = excerptStart > 0 ? '…' : ''
  const suffix = excerptEnd < text.length ? '…' : ''
  return { text: `${prefix}${text.slice(excerptStart, excerptEnd)}${suffix}`, start: start - excerptStart + prefix.length, end: end - excerptStart + prefix.length }
}

function isHighSurrogate(value: number) { return value >= 0xd800 && value <= 0xdbff }
function isLowSurrogate(value: number) { return value >= 0xdc00 && value <= 0xdfff }

function locatorFor(block: ReaderSearchIndexBlock, matchStart: number): ReaderLocator {
  if (block.kind === 'pdf') return { version: 1, kind: 'pdf', resourceKey: block.resourceKey, pageNumber: block.sectionIndex + 1 }
  return { version: 1, kind: 'reflowable', resourceKey: block.resourceKey, sectionId: block.sectionId, sectionIndex: block.sectionIndex, blockId: block.blockId, textOffset: matchStart }
}

export function searchReaderIndex(index: ReaderSearchIndexBlock[], query: string, limit = readerSearchResultLimit): ReaderSearchResponse {
  const normalizedQuery = normalizeSearchText(query)
  const response: ReaderSearchResponse = { query, totalMatches: 0, truncated: false, results: [] }
  if (!normalizedQuery || normalizedQuery.length < 2) return response

  for (const block of index) {
    appendBlockMatches(response, block, normalizedQuery, limit)
  }
  response.truncated = response.totalMatches > response.results.length
  return response
}

function appendBlockMatches(response: ReaderSearchResponse, block: ReaderSearchIndexBlock, normalizedQuery: string, limit: number) {
  const searchableText = block.offsetMapIsIdentity ? block.text.toLowerCase() : block.normalizedText
  let from = 0
  while (from <= searchableText.length - normalizedQuery.length) {
    const match = searchableText.indexOf(normalizedQuery, from)
    if (match < 0) break
    response.totalMatches += 1
    if (response.results.length < limit) {
      const matchStart = block.offsetMapIsIdentity ? match : block.normalizedToOriginal[match * 2] ?? 0
      const matchEnd = block.offsetMapIsIdentity ? match + normalizedQuery.length : block.normalizedToOriginal[(match + normalizedQuery.length - 1) * 2 + 1] ?? matchStart
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

export async function searchReaderIndexAsync(index: ReaderSearchIndexBlock[], query: string, limit = readerSearchResultLimit, taskOptions: ReaderSearchTaskOptions = {}): Promise<ReaderSearchResponse> {
  const normalizedQuery = normalizeSearchText(query)
  const response: ReaderSearchResponse = { query, totalMatches: 0, truncated: false, results: [] }
  if (!normalizedQuery || normalizedQuery.length < 2) return response
  const batchSize = Math.max(1, taskOptions.batchSize ?? 1024)
  let processed = 0
  for (const block of index) {
    throwIfAborted(taskOptions.signal)
    appendBlockMatches(response, block, normalizedQuery, limit)
    processed += 1
    if (processed >= batchSize) {
      processed = 0
      await yieldToEventLoop()
    }
  }
  throwIfAborted(taskOptions.signal)
  response.truncated = response.totalMatches > response.results.length
  return response
}

export function searchReaderSections(options: ReaderSearchIndexOptions, query: string, limit = readerSearchResultLimit) {
  return searchReaderIndex(createReaderSearchIndex(options), query, limit)
}
