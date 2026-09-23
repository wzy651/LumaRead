import { afterEach, describe, expect, it, vi } from 'vitest'
import { legacyReaderSettingsStorageKey, normalizeReaderSettings, readerSettingsDefaults, readerSettingsStorageKey, readReaderSettings, v3ReaderSettingsStorageKey } from './useReaderSettings'

function storage(values: Record<string, string> = {}, failWrites = false) {
  return {
    getItem: vi.fn((key: string) => values[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { if (failWrites) throw new Error('disabled'); values[key] = value }),
  }
}

afterEach(() => vi.unstubAllGlobals())

describe('reader settings v2', () => {
  it('migrates v1 while preserving the existing typography preferences', () => {
    const localStorage = storage({ [legacyReaderSettingsStorageKey]: JSON.stringify({ fontFamily: 'sans', fontScale: 1.15, lineHeight: 'relaxed' }) })
    vi.stubGlobal('window', { localStorage })
    expect(readReaderSettings()).toEqual({ fontFamily: 'sans', fontScale: 1.15, lineHeight: 'relaxed', textWidthCh: 64, mobileSideMargin: 'comfortable', textAlignment: 'auto', epubReadingMode: 'scroll' })
    expect(localStorage.setItem).toHaveBeenCalledWith(readerSettingsStorageKey, expect.any(String))
  })

  it('migrates v3 to v4 with Scroll as the old-user default and rejects invalid modes', () => {
    const localStorage = storage({ [v3ReaderSettingsStorageKey]: JSON.stringify({ fontFamily: 'sans', textWidthCh: 72, epubReadingMode: 'unknown' }) })
    vi.stubGlobal('window', { localStorage })
    expect(readReaderSettings()).toMatchObject({ fontFamily: 'sans', textWidthCh: 72, epubReadingMode: 'scroll' })
    expect(JSON.parse(localStorage.setItem.mock.calls[0][1])).toMatchObject({ epubReadingMode: 'scroll' })
    expect(normalizeReaderSettings({ epubReadingMode: 'pages' })).toMatchObject({ epubReadingMode: 'pages' })
    expect(normalizeReaderSettings({ epubReadingMode: 'broken' } as never)).toMatchObject({ epubReadingMode: 'scroll' })
  })

  it('prefers v2 and safely normalizes invalid stored values', () => {
    const localStorage = storage({ [readerSettingsStorageKey]: JSON.stringify({ fontFamily: 'comic', fontScale: 9, lineHeight: 'spacious', pageWidth: 'extra', textAlignment: 'centre' }) })
    vi.stubGlobal('window', { localStorage })
    expect(readReaderSettings()).toEqual(readerSettingsDefaults)
    expect(normalizeReaderSettings({ textWidthCh: 74, textAlignment: 'justify' })).toMatchObject({ textWidthCh: 74, textAlignment: 'justify' })
  })

  it('keeps the migrated settings in memory when storage writes fail', () => {
    const localStorage = storage({ [legacyReaderSettingsStorageKey]: JSON.stringify({ fontScale: 1.1 }) }, true)
    vi.stubGlobal('window', { localStorage })
    expect(readReaderSettings()).toMatchObject({ fontScale: 1.1, textWidthCh: 64 })
  })
})
