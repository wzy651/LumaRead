import type { ReaderSettings } from './useReaderSettings'

export type ReaderLayout = {
  className: string
  styleVariables: Record<string, string | number>
}

const lineHeights = {
  compact: { desktop: 1.58, mobile: 1.54 },
  comfortable: { desktop: 1.72, mobile: 1.68 },
  relaxed: { desktop: 1.88, mobile: 1.84 },
} as const

const pageWidths = { narrow: '54ch', comfortable: '64ch', wide: '74ch' } as const
const mobileGutters = { narrow: 'clamp(28px, 9vw, 40px)', comfortable: 'clamp(20px, 6vw, 28px)', wide: 'max(16px, 4vw)' } as const

/** Shared, presentation-only reader layout resolution. */
export function resolveReaderLayout(settings: ReaderSettings, isMobile: boolean): ReaderLayout {
  const shouldJustify = settings.textAlignment === 'justify' || (settings.textAlignment === 'auto' && !isMobile)
  return {
    className: shouldJustify ? 'reader-article--justify' : 'reader-article--left',
    styleVariables: {
      '--reader-font-scale': settings.fontScale,
      '--reader-line-height': lineHeights[settings.lineHeight][isMobile ? 'mobile' : 'desktop'],
      '--reader-font-family': settings.fontFamily === 'serif' ? 'var(--font-reading)' : 'var(--font-ui)',
      '--reader-content-width': pageWidths[settings.pageWidth],
      '--reader-mobile-gutter': mobileGutters[settings.pageWidth],
    },
  }
}

/** Imported metadata may be absent or deliberately unspecified; LumaRead is an English-learning reader. */
export function readerLanguage(language?: string): string {
  const value = language?.trim()
  return value && value.toLowerCase() !== 'und' ? value : 'en'
}
