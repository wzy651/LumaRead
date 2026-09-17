import { useEffect, useState } from 'react'

export type ReaderFontFamily = 'serif' | 'sans'
export type ReaderLineHeight = 'compact' | 'comfortable' | 'relaxed'
export type ReaderTextAlignment = 'auto' | 'left' | 'justify'
export type MobileSideMargin = 'compact' | 'comfortable' | 'spacious'

export interface ReaderSettings {
  fontFamily: ReaderFontFamily
  fontScale: number
  lineHeight: ReaderLineHeight
  textWidthCh: number
  mobileSideMargin: MobileSideMargin
  textAlignment: ReaderTextAlignment
  /** v2 compatibility only; persisted v3 settings use textWidthCh. */
  pageWidth?: 'narrow' | 'comfortable' | 'wide'
}

export const readerSettingsStorageKey = 'lumaread-reader-settings:v3'
export const v2ReaderSettingsStorageKey = 'lumaread-reader-settings:v2'
export const legacyReaderSettingsStorageKey = 'lumaread-reader-settings:v1'
export const readerSettingsDefaults: ReaderSettings = { fontFamily: 'serif', fontScale: 1, lineHeight: 'comfortable', textWidthCh: 64, mobileSideMargin: 'comfortable', textAlignment: 'auto' }

export function normalizeReaderSettings(stored: Partial<ReaderSettings> | null | undefined): ReaderSettings {
  return {
    fontFamily: stored?.fontFamily === 'sans' ? 'sans' : 'serif',
    fontScale: typeof stored?.fontScale === 'number' && stored.fontScale >= 0.9 && stored.fontScale <= 1.2 ? stored.fontScale : 1,
    lineHeight: stored?.lineHeight === 'compact' || stored?.lineHeight === 'relaxed' ? stored.lineHeight : 'comfortable',
    textWidthCh: typeof stored?.textWidthCh === 'number' && Number.isInteger(stored.textWidthCh) && stored.textWidthCh >= 48 && stored.textWidthCh <= 80 && stored.textWidthCh % 2 === 0 ? stored.textWidthCh : 64,
    mobileSideMargin: stored?.mobileSideMargin === 'compact' || stored?.mobileSideMargin === 'spacious' ? stored.mobileSideMargin : 'comfortable',
    textAlignment: stored?.textAlignment === 'left' || stored?.textAlignment === 'justify' ? stored.textAlignment : 'auto',
  }
}

export function readReaderSettings(): ReaderSettings {
  if (typeof window === 'undefined') return readerSettingsDefaults
  try {
    const v3 = window.localStorage.getItem(readerSettingsStorageKey)
    if (v3 !== null) return normalizeReaderSettings(JSON.parse(v3) as Partial<ReaderSettings>)
    const v2 = window.localStorage.getItem(v2ReaderSettingsStorageKey)
    const v1 = window.localStorage.getItem(legacyReaderSettingsStorageKey)
    const old = v2 ?? v1
    const raw = old === null ? undefined : JSON.parse(old) as Partial<ReaderSettings> & { pageWidth?: 'narrow' | 'comfortable' | 'wide' }
    const migrated = normalizeReaderSettings(raw ? { ...raw, textWidthCh: raw.textWidthCh ?? (raw.pageWidth === 'narrow' ? 54 : raw.pageWidth === 'wide' ? 74 : 64) } : undefined)
    if (old !== null) {
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
