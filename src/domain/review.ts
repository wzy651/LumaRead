export interface ReviewItem {
  id: string
  vocabularyId: string
  prompt: string
  answer: string
  sourceSentence: string
}

export interface SessionSummary {
  durationMinutes: number
  wordsRead: number
  lookupCount: number
  expressionsToReview: number
}
