/** Learning state only; lookup behavior is represented by LookupEvent. */
export type VocabularyStatus = 'unknown' | 'learning' | 'recognized' | 'active'

export interface VocabularyItem {
  id: string
  term: string
  pronunciation: string
  definition: string
  sourceSentence: string
  contextNote: string
  /** @deprecated Prototype/legacy mirror only; real learning uses getVocabularyState. */
  readonly status: VocabularyStatus
  addedToLearning: boolean
}
