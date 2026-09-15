import { useEffect, useState } from 'react'

export type ReaderFontFamily = 'serif' | 'sans'
export type ReaderLineHeight = 'compact' | 'comfortable' | 'relaxed'

export interface ReaderSettings {
  fontFamily: ReaderFontFamily
  fontScale: number
  lineHeight: ReaderLineHeight
}

const storageKey = 'lumaread-reader-settings:v1'
const defaults: ReaderSettings = { fontFamily: 'serif', fontScale: 1, lineHeight: 'comfortable' }

function readSettings(): ReaderSettings {
  if (typeof window === 'undefined') return defaults
  try {
    const stored = JSON.parse(window.localStorage.getItem(storageKey) ?? '{}') as Partial<ReaderSettings>
    return {
      fontFamily: stored.fontFamily === 'sans' ? 'sans' : 'serif',
      fontScale: typeof stored.fontScale === 'number' && stored.fontScale >= 0.9 && stored.fontScale <= 1.2 ? stored.fontScale : 1,
      lineHeight: stored.lineHeight === 'compact' || stored.lineHeight === 'relaxed' ? stored.lineHeight : 'comfortable',
    }
  } catch {
    return defaults
  }
}

export function useReaderSettings() {
  const [settings, setSettings] = useState<ReaderSettings>(readSettings)

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(settings))
  }, [settings])

  return { settings, setSettings }
}
