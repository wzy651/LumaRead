export interface Book {
  id: string
  title: string
  author: string
  coverUrl: string
  currentChapter: string
  progress: ReadingProgress
}

export interface ReadingProgress {
  completedPercent: number
  currentLocation: string
  wordsRead: number
}
