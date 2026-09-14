export interface Book {
  id: string
  title: string
  author: string
  /** Optional asset URL; owning features render a fallback when absent. */
  coverUrl?: string
  progress: ReadingProgress
}

export interface ReadingProgress {
  completedPercent: number
  locationLabel: string
  wordsRead: number
}
