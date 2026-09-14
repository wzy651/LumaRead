import type { Book } from '../domain'

/** Covers are optional; features provide their own visual fallback when coverUrl is absent. */
export const books: Book[] = [
  { id: 'pride-and-prejudice', title: 'Pride and Prejudice', author: 'Jane Austen', progress: { completedPercent: 36, locationLabel: 'Chapter 12', wordsRead: 28400 } },
  { id: 'the-great-gatsby', title: 'The Great Gatsby', author: 'F. Scott Fitzgerald', progress: { completedPercent: 18, locationLabel: 'Chapter 3', wordsRead: 12300 } },
  { id: 'little-women', title: 'Little Women', author: 'Louisa May Alcott', progress: { completedPercent: 52, locationLabel: 'Chapter 7', wordsRead: 40200 } },
]

export const currentBook = books[0]
