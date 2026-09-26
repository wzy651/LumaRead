export type HelpMode = 'context' | 'translate' | 'simplify' | 'detail'
export interface ReadingExcerpt {
  text: string
  sentence: string
  resourceKey: string
  bookTitle: string
  sectionId?: string
  blockId?: string
  pageNumber?: number
}
export interface DictionaryEntry { word: string; phonetic: string; translation: string; definition: string; source: 'ECDICT' }
export interface AISettings { protocol: 'compatible' | 'ollama'; baseUrl: string; model: string }
export interface ContextProvider { explain(excerpt: ReadingExcerpt, mode: HelpMode, signal: AbortSignal): Promise<string> }
export interface LookupRecord extends ReadingExcerpt { id: string; normalized: string; createdAt: string }
export interface LearningTerm { normalized: string; text: string; status: 'unknown' | 'learning' | 'recognized' | 'active'; lookups: number; lastSeen: string; example: ReadingExcerpt }
