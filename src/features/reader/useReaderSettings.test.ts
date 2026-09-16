import { afterEach, describe, expect, it, vi } from 'vitest'
import { legacyReaderSettingsStorageKey, normalizeReaderSettings, readerSettingsDefaults, readerSettingsStorageKey, readReaderSettings } from './useReaderSettings'

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
    expect(readReaderSettings()).toEqual({ fontFamily: 'sans', fontScale: 1.15, lineHeight: 'relaxed', pageWidth: 'comfortable', textAlignment: 'auto' })
    expect(localStorage.setItem).toHaveBeenCalledWith(readerSettingsStorageKey, expect.any(String))
  })

  it('prefers v2 and safely normalizes invalid stored values', () => {
    const localStorage = storage({ [readerSettingsStorageKey]: JSON.stringify({ fontFamily: 'comic', fontScale: 9, lineHeight: 'spacious', pageWidth: 'extra', textAlignment: 'centre' }) })
    vi.stubGlobal('window', { localStorage })
    expect(readReaderSettings()).toEqual(readerSettingsDefaults)
    expect(normalizeReaderSettings({ pageWidth: 'wide', textAlignment: 'justify' })).toMatchObject({ pageWidth: 'wide', textAlignment: 'justify' })
  })

  it('keeps the migrated settings in memory when storage writes fail', () => {
    const localStorage = storage({ [legacyReaderSettingsStorageKey]: JSON.stringify({ fontScale: 1.1 }) }, true)
    vi.stubGlobal('window', { localStorage })
    expect(readReaderSettings()).toMatchObject({ fontScale: 1.1, pageWidth: 'comfortable' })
  })
})
