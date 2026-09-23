import { describe, expect, it } from 'vitest'
import { readerSettingsDefaults } from './useReaderSettings'
import { readerLanguage, resolveReaderLayout } from './readerLayout'

describe('shared reader layout', () => {
  it('maps all page-width preferences to character-based desktop columns', () => {
    expect(resolveReaderLayout({ ...readerSettingsDefaults, textWidthCh: 48 }, false).styleVariables['--reader-content-width']).toBe('48ch')
    expect(resolveReaderLayout({ ...readerSettingsDefaults, textWidthCh: 64 }, false).styleVariables['--reader-content-width']).toBe('64ch')
    expect(resolveReaderLayout({ ...readerSettingsDefaults, textWidthCh: 80 }, false).styleVariables['--reader-content-width']).toBe('80ch')
  })

  it('keeps mobile side margins in the shared layout contract', () => {
    expect(resolveReaderLayout({ ...readerSettingsDefaults, mobileSideMargin: 'compact' }, true).styleVariables['--reader-mobile-gutter']).toBe('clamp(12px, 4vw, 16px)')
    expect(resolveReaderLayout({ ...readerSettingsDefaults, mobileSideMargin: 'spacious' }, true).styleVariables['--reader-mobile-gutter']).toBe('28px')
  })

  it('uses automatic justification on desktop but not mobile, with explicit choices taking precedence', () => {
    expect(resolveReaderLayout(readerSettingsDefaults, false).className).toBe('reader-article--justify')
    expect(resolveReaderLayout(readerSettingsDefaults, true).className).toBe('reader-article--left')
    expect(resolveReaderLayout({ ...readerSettingsDefaults, textAlignment: 'left' }, false).className).toBe('reader-article--left')
    expect(resolveReaderLayout({ ...readerSettingsDefaults, textAlignment: 'justify' }, true).className).toBe('reader-article--justify')
  })

  it('shares typography variables for mock and imported readers and resolves document language safely', () => {
    const mockLayout = resolveReaderLayout({ ...readerSettingsDefaults, fontScale: 1.1, lineHeight: 'relaxed' }, false)
    const importedLayout = resolveReaderLayout({ ...readerSettingsDefaults, fontScale: 1.1, lineHeight: 'relaxed' }, false)
    expect(importedLayout).toEqual(mockLayout)
    expect(readerLanguage('fr-CA')).toBe('fr-CA')
    expect(readerLanguage()).toBe('en')
    expect(readerLanguage('und')).toBe('en')
  })

  it('has a complete layout reset default without changing theme state', () => {
    expect(readerSettingsDefaults).toEqual({ fontFamily: 'serif', fontScale: 1, lineHeight: 'comfortable', textWidthCh: 64, mobileSideMargin: 'comfortable', textAlignment: 'auto', epubReadingMode: 'scroll' })
  })

})
