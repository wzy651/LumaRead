export type HelpMode = 'context' | 'translate' | 'simplify' | 'detail'
export interface ReadingExcerpt {
  text: string
  sentence: string
  /** UTF-16 offset of the selected occurrence within sentence (not a first-match guess). */
  selectionStart?: number
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
export type Proficiency = 'unknown' | 'recognized' | 'active'
export interface VocabularyState {
  proficiency: Proficiency
  learningEnabled: boolean
  basis: 'unassessed' | 'self' | 'legacy'
  assessedAt?: string
  revision: number
}
export type VocabularyAction = { type: 'enroll' | 'unenroll' } | { type: 'assess'; level: Proficiency } | { type: 'assess-and-unenroll'; level: 'recognized' }
export interface LearningTerm {
  normalized: string
  text: string
  /** @deprecated Compatibility mirror only. Use getVocabularyState and explicit actions. */
  readonly status: 'unknown' | 'learning' | 'recognized' | 'active'
  vocabularyState?: VocabularyState
  lookups: number
  lastSeen: string
  example: ReadingExcerpt
  candidateExcluded?: boolean
}
