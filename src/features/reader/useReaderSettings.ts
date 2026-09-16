import { useEffect, useState } from 'react'

export type ReaderFontFamily = 'serif' | 'sans'
export type ReaderLineHeight = 'compact' | 'comfortable' | 'relaxed'
export type ReaderPageWidth = 'narrow' | 'comfortable' | 'wide'
export type ReaderTextAlignment = 'auto' | 'left' | 'justify'

export interface ReaderSettings {
  fontFamily: ReaderFontFamily
  fontScale: number
  lineHeight: ReaderLineHeight
  pageWidth: ReaderPageWidth
  textAlignment: ReaderTextAlignment
}

export const readerSettingsStorageKey = 'lumaread-reader-settings:v2'
export const legacyReaderSettingsStorageKey = 'lumaread-reader-settings:v1'
export const readerSettingsDefaults: ReaderSettings = { fontFamily: 'serif', fontScale: 1, lineHeight: 'comfortable', pageWidth: 'comfortable', textAlignment: 'auto' }

export function normalizeReaderSettings(stored: Partial<ReaderSettings> | null | undefined): ReaderSettings {
  return {
    fontFamily: stored?.fontFamily === 'sans' ? 'sans' : 'serif',
    fontScale: typeof stored?.fontScale === 'number' && stored.fontScale >= 0.9 && stored.fontScale <= 1.2 ? stored.fontScale : 1,
    lineHeight: stored?.lineHeight === 'compact' || stored?.lineHeight === 'relaxed' ? stored.lineHeight : 'comfortable',
    pageWidth: stored?.pageWidth === 'narrow' || stored?.pageWidth === 'wide' ? stored.pageWidth : 'comfortable',
    textAlignment: stored?.textAlignment === 'left' || stored?.textAlignment === 'justify' ? stored.textAlignment : 'auto',
  }
}

export function readReaderSettings(): ReaderSettings {
  if (typeof window === 'undefined') return readerSettingsDefaults
  try {
    const v2 = window.localStorage.getItem(readerSettingsStorageKey)
    if (v2 !== null) return normalizeReaderSettings(JSON.parse(v2) as Partial<ReaderSettings>)
    const v1 = window.localStorage.getItem(legacyReaderSettingsStorageKey)
    const migrated = normalizeReaderSettings(v1 === null ? undefined : JSON.parse(v1) as Partial<ReaderSettings>)
    if (v1 !== null) {
      try { window.localStorage.setItem(readerSettingsStorageKey, JSON.stringify(migrated)) } catch { /* React state remains usable. */ }
    }
    return migrated
  } catch {
    return readerSettingsDefaults
  }
}

export function useReaderSettings() {
  const [settings, setSettings] = useState<ReaderSettings>(readReaderSettings)

  useEffect(() => {
    try {
      window.localStorage.setItem(readerSettingsStorageKey, JSON.stringify(settings))
    } catch {
      // Storage may be disabled; React state remains the current-session source of truth.
    }
  }, [settings])

  return { settings, setSettings }
}
