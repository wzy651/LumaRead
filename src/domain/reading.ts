export interface ReadingSession {
  id: string
  bookId: string
  startedAt: string
  durationMinutes: number
  wordsRead: number
  lookupCount: number
}

export interface LookupEvent {
  id: string
  bookId: string
  vocabularyId: string
  sourceSentence: string
  lookedUpAt: string
}
