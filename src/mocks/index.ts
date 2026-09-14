import type { Book, ReviewItem, SessionSummary, VocabularyItem } from '../domain'

export const books: Book[] = [
  { id: 'pride-and-prejudice', title: 'Pride and Prejudice', author: 'Jane Austen', coverUrl: '', currentChapter: 'Chapter 12', progress: { completedPercent: 36, currentLocation: 'Chapter 12', wordsRead: 28400 } },
  { id: 'the-great-gatsby', title: 'The Great Gatsby', author: 'F. Scott Fitzgerald', coverUrl: '', currentChapter: 'Chapter 3', progress: { completedPercent: 18, currentLocation: 'Chapter 3', wordsRead: 12300 } },
  { id: 'little-women', title: 'Little Women', author: 'Louisa May Alcott', coverUrl: '', currentChapter: 'Chapter 7', progress: { completedPercent: 52, currentLocation: 'Chapter 7', wordsRead: 40200 } },
]

export const currentBook = books[0]

export const vocabularyItems: VocabularyItem[] = [
  { id: 'reluctantly', term: 'reluctantly', pronunciation: '/rɪˈlʌktəntli/', definition: '不情愿地', sourceSentence: 'Hermione reluctantly followed him into the room.', contextNote: 'She followed, but did not really want to.', status: 'looked-up', addedToLearning: false },
  { id: 'intervention', term: 'intervention', pronunciation: '/ˌɪntəˈvenʃən/', definition: '干预', sourceSentence: 'Had it not been for his intervention, the plan would have failed.', contextNote: 'An action that changed what happened.', status: 'learning', addedToLearning: true },
  { id: 'glance', term: 'glance', pronunciation: '/ɡlɑːns/', definition: '瞥一眼', sourceSentence: 'She gave him a quick glance.', contextNote: 'A brief look.', status: 'known', addedToLearning: true },
  { id: 'hesitate', term: 'hesitate', pronunciation: '/ˈhezɪteɪt/', definition: '犹豫', sourceSentence: 'He did not hesitate before answering.', contextNote: 'To pause before deciding.', status: 'learning', addedToLearning: true },
  { id: 'murmur', term: 'murmur', pronunciation: '/ˈmɜːmə(r)/', definition: '低声说', sourceSentence: 'She murmured an answer.', contextNote: 'To speak very quietly.', status: 'new', addedToLearning: false },
]

export const reviewItems: ReviewItem[] = [
  { id: 'review-reluctantly', vocabularyId: 'reluctantly', prompt: 'Hermione ______ followed him into the room.', answer: 'reluctantly', sourceSentence: vocabularyItems[0].sourceSentence },
  { id: 'review-intervention', vocabularyId: 'intervention', prompt: 'His ______ changed the outcome.', answer: 'intervention', sourceSentence: vocabularyItems[1].sourceSentence },
  { id: 'review-glance', vocabularyId: 'glance', prompt: 'She gave him a quick ______.', answer: 'glance', sourceSentence: vocabularyItems[2].sourceSentence },
  { id: 'review-hesitate', vocabularyId: 'hesitate', prompt: 'Do not ______ to ask for help.', answer: 'hesitate', sourceSentence: vocabularyItems[3].sourceSentence },
]

export const sessionSummary: SessionSummary = { durationMinutes: 38, wordsRead: 5420, lookupCount: 12, expressionsToReview: 4 }
