import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import type { DocumentSection } from '../../../domain/documents'
import { createReaderSearchIndex, hasSearchableText, searchReaderIndex, type ReaderSearchIndexBlock, type ReaderSearchKind, type ReaderSearchResult, type ReaderSearchResponse } from '../reader-search'

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

export const ReaderSearchPanel = forwardRef<ReaderSearchPanelHandle, Props>(function ReaderSearchPanel({ resourceKey, sections, kind, onSelect }, ref) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const index = useMemo<ReaderSearchIndexBlock[]>(() => createReaderSearchIndex({ resourceKey, sections, kind }), [kind, resourceKey, sections])
  const searchable = hasSearchableText(sections)

  useImperativeHandle(ref, () => ({ focusAndSelect: () => { inputRef.current?.focus(); inputRef.current?.select() } }), [])

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query)
    }, 180)
    return () => window.clearTimeout(timer)
  }, [query])

  const response = useMemo<ReaderSearchResponse>(() => searchReaderIndex(index, debouncedQuery), [debouncedQuery, index])
  const searching = query !== debouncedQuery
  const activeResultIndex = response.results.length ? Math.min(selectedIndex, response.results.length - 1) : 0

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    event.stopPropagation()
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!response.results.length) return
      setSelectedIndex((current) => (current + (event.key === 'ArrowDown' ? 1 : -1) + response.results.length) % response.results.length)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const result = response.results[activeResultIndex] ?? response.results[0]
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
    if (searching) return 'Searching…'
    if (!response.totalMatches) return 'No matches found.'
    return `${response.totalMatches} ${response.totalMatches === 1 ? 'match' : 'matches'}${response.truncated ? ` (showing first ${response.results.length})` : ''}`
  }

  return <div className="reader-search">
    <div className="reader-search__input-row">
      <input aria-label="Search in current book" autoComplete="off" data-autofocus="true" placeholder="Search in this book" ref={inputRef} type="search" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={handleKeyDown} />
      {query && <button aria-label="Clear search" className="reader-search__clear" onClick={() => { setQuery(''); inputRef.current?.focus() }} type="button">Clear</button>}
    </div>
    <p aria-live="polite" className="reader-search__status">{status()}</p>
    {response.results.length > 0 && <ol aria-label="Search results" className="reader-search__results">
      {response.results.map((result, index) => <li key={result.id}><button aria-current={index === activeResultIndex ? 'true' : undefined} className={`reader-search-result ${index === activeResultIndex ? 'is-selected' : ''}`} onClick={() => onSelect(result)} onMouseEnter={() => setSelectedIndex(index)} type="button"><strong>{result.sectionLabel}</strong><HighlightedExcerpt result={result} /></button></li>)}
    </ol>}
  </div>
})
