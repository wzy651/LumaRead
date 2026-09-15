import type { ReviewItem } from '../domain'
import { vocabularyItems } from './vocabulary'

export const reviewItems: ReviewItem[] = [
  { id: 'review-reluctantly', vocabularyId: 'reluctantly', prompt: 'Elizabeth ______ followed Jane into the drawing room.', answer: 'reluctantly', sourceSentence: vocabularyItems[0].sourceSentence },
  { id: 'review-glance', vocabularyId: 'glance', prompt: 'Elizabeth cast Darcy a quick ______ before answering.', answer: 'glance', sourceSentence: vocabularyItems[2].sourceSentence },
  { id: 'review-hesitate', vocabularyId: 'hesitate', prompt: 'Jane did not ______ before offering a gentler account.', answer: 'hesitate', sourceSentence: vocabularyItems[3].sourceSentence },
  { id: 'review-murmur', vocabularyId: 'murmur', prompt: 'Jane ______ that the matter was best left alone.', answer: 'murmured', sourceSentence: vocabularyItems[4].sourceSentence },
]
