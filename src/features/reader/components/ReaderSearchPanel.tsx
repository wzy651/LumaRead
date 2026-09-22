import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type KeyboardEvent } from 'react'
import type { DocumentSection } from '../../../domain/documents'
import { createReaderSearchIndexAsync, hasSearchableText, searchReaderIndexAsync, type ReaderSearchIndexBlock, type ReaderSearchKind, type ReaderSearchResult, type ReaderSearchResponse } from '../reader-search'

export interface ReaderSearchPanelHandle {
  focusAndSelect: () => void
}

interface Props {
  resourceKey: string
  sections: DocumentSection[]
  kind: ReaderSearchKind
  onSelect: (result: ReaderSearchResult) => void
}

function HighlightedExcerpt({ result }: { result: ReaderSearchResult }) {
  const before = result.excerpt.slice(0, result.excerptMatchStart)
  const match = result.excerpt.slice(result.excerptMatchStart, result.excerptMatchEnd)
  const after = result.excerpt.slice(result.excerptMatchEnd)
  return <span className="reader-search-result__excerpt">{before}<mark>{match}</mark>{after}</span>
}

function emptyResponse(query: string): ReaderSearchResponse {
  return { query, totalMatches: 0, truncated: false, results: [] }
}

export const ReaderSearchPanel = forwardRef<ReaderSearchPanelHandle, Props>(function ReaderSearchPanel({ resourceKey, sections, kind, onSelect }, ref) {
  const inputRef = useRef<HTMLInputElement>(null)
  const composingRef = useRef(false)
  const searchGenerationRef = useRef(0)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [indexed, setIndexed] = useState<{ resourceKey: string; kind: ReaderSearchKind; sections: DocumentSection[]; index: ReaderSearchIndexBlock[] }>()
  const [response, setResponse] = useState<ReaderSearchResponse>(() => emptyResponse(''))
  const index = indexed?.resourceKey === resourceKey && indexed.kind === kind && indexed.sections === sections ? indexed.index : undefined
  const indexing = !index
  const searchable = hasSearchableText(sections)

  useImperativeHandle(ref, () => ({ focusAndSelect: () => { inputRef.current?.focus(); inputRef.current?.select() } }), [])

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query)
    }, 180)
    return () => window.clearTimeout(timer)
  }, [query])

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    void createReaderSearchIndexAsync({ resourceKey, sections, kind }, { signal: controller.signal }).then((nextIndex) => {
      if (!active || controller.signal.aborted) return
      setIndexed({ resourceKey, kind, sections, index: nextIndex })
    }).catch(() => undefined)
    return () => {
      active = false
      controller.abort()
    }
  }, [kind, resourceKey, sections])

  useEffect(() => {
    const generation = searchGenerationRef.current + 1
    searchGenerationRef.current = generation
    const controller = new AbortController()
    if (!index || !debouncedQuery.trim()) {
      return () => controller.abort()
    }
    void searchReaderIndexAsync(index, debouncedQuery, undefined, { signal: controller.signal }).then((nextResponse) => {
      if (!controller.signal.aborted && searchGenerationRef.current === generation) {
        setResponse(nextResponse)
      }
    }).catch(() => {
      if (!controller.signal.aborted && searchGenerationRef.current === generation) setResponse(emptyResponse(debouncedQuery))
    })
    return () => controller.abort()
  }, [debouncedQuery, index])

  const queryIsChanging = query !== debouncedQuery
  const searching = queryIsChanging || indexing || (Boolean(debouncedQuery.trim()) && response.query !== debouncedQuery)
  const showingResults = !queryIsChanging && !indexing && response.query === debouncedQuery && Boolean(debouncedQuery.trim())
  const displayedResponse = showingResults ? response : emptyResponse(query)
  const activeResultIndex = displayedResponse.results.length ? Math.min(selectedIndex, displayedResponse.results.length - 1) : 0

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    const nativeEvent = event.nativeEvent as globalThis.KeyboardEvent
    if (event.key === 'Escape') {
      if (nativeEvent.isComposing || composingRef.current) {
        event.preventDefault()
        event.stopPropagation()
      }
      return
    }
    event.stopPropagation()
    if (nativeEvent.isComposing || composingRef.current) {
      if (event.key === 'Enter') event.preventDefault()
      return
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!displayedResponse.results.length) return
      setSelectedIndex((current) => (current + (event.key === 'ArrowDown' ? 1 : -1) + displayedResponse.results.length) % displayedResponse.results.length)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const result = displayedResponse.results[activeResultIndex] ?? displayedResponse.results[0]
      if (result) onSelect(result)
    } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
      event.preventDefault()
      inputRef.current?.select()
    }
  }

  function status() {
    if (!searchable && kind === 'pdf') return 'No searchable text was found. OCR search is not available yet.'
    if (!searchable) return 'No searchable text is available.'
    if (!query.trim()) return 'Search this book by word or phrase.'
    if (query.trim().length < 2) return 'Type at least 2 characters to search.'
    if (indexing || queryIsChanging || searching) return 'Searching…'
    if (!response.totalMatches) return 'No matches found.'
    return `${response.totalMatches} ${response.totalMatches === 1 ? 'match' : 'matches'}${response.truncated ? ` (showing first ${response.results.length})` : ''}`
  }

  return <div className="reader-search">
    <div className="reader-search__input-row">
      <input aria-label="Search in current book" autoComplete="off" data-autofocus="true" placeholder="Search in this book" ref={inputRef} type="search" value={query} onChange={(event) => setQuery(event.target.value)} onCompositionEnd={() => { composingRef.current = false }} onCompositionStart={() => { composingRef.current = true }} onKeyDown={handleKeyDown} />
      {query && <button aria-label="Clear search" className="reader-search__clear" onClick={() => { setQuery(''); inputRef.current?.focus() }} type="button">Clear</button>}
    </div>
    <p aria-live="polite" className="reader-search__status">{status()}</p>
    {displayedResponse.results.length > 0 && <ol aria-label="Search results" className="reader-search__results">
      {displayedResponse.results.map((result, index) => <li key={result.id}><button aria-current={index === activeResultIndex ? 'true' : undefined} className={`reader-search-result ${index === activeResultIndex ? 'is-selected' : ''}`} onClick={() => onSelect(result)} onMouseEnter={() => setSelectedIndex(index)} type="button"><strong>{result.sectionLabel}</strong><HighlightedExcerpt result={result} /></button></li>)}
    </ol>}
  </div>
})
