export type VocabularyStatus = 'new' | 'looked-up' | 'learning' | 'known'

export interface VocabularyItem {
  id: string
  term: string
  pronunciation: string
  definition: string
  sourceSentence: string
  contextNote: string
  status: VocabularyStatus
  addedToLearning: boolean
}
