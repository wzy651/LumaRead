import { describe, expect, it } from 'vitest'
import { readerSettingsDefaults } from './useReaderSettings'
import { readerLanguage, resolveReaderLayout } from './readerLayout'

describe('shared reader layout', () => {
  it('maps all page-width preferences to character-based desktop columns', () => {
    expect(resolveReaderLayout({ ...readerSettingsDefaults, pageWidth: 'narrow' }, false).styleVariables['--reader-content-width']).toBe('54ch')
    expect(resolveReaderLayout({ ...readerSettingsDefaults, pageWidth: 'comfortable' }, false).styleVariables['--reader-content-width']).toBe('64ch')
    expect(resolveReaderLayout({ ...readerSettingsDefaults, pageWidth: 'wide' }, false).styleVariables['--reader-content-width']).toBe('74ch')
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
    expect(readerSettingsDefaults).toEqual({ fontFamily: 'serif', fontScale: 1, lineHeight: 'comfortable', pageWidth: 'comfortable', textAlignment: 'auto' })
  })

})
