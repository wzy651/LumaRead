export const readingContentKinds = ['builtin', 'imported'] as const
export type ReadingContentKind = (typeof readingContentKinds)[number]
export interface ReadingActivity { key: string; documentId: string; contentKind: ReadingContentKind; firstOpenedAt: string; lastOpenedAt: string; lastReadAt?: string; sectionId?: string; sectionIndex?: number; locationLabel?: string; progressPercent?: number }
export function readingActivityKey(contentKind: ReadingContentKind, documentId: string) { return `${contentKind}:${documentId}` }
