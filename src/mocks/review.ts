import type { ReviewItem } from '../domain'
import { vocabularyItems } from './vocabulary'

export const reviewItems: ReviewItem[] = [
  { id: 'review-reluctantly', vocabularyId: 'reluctantly', prompt: 'Hermione ______ followed him into the room.', answer: 'reluctantly', sourceSentence: vocabularyItems[0].sourceSentence },
  { id: 'review-intervention', vocabularyId: 'intervention', prompt: 'His ______ changed the outcome.', answer: 'intervention', sourceSentence: vocabularyItems[1].sourceSentence },
  { id: 'review-glance', vocabularyId: 'glance', prompt: 'She gave him a quick ______.', answer: 'glance', sourceSentence: vocabularyItems[2].sourceSentence },
  { id: 'review-hesitate', vocabularyId: 'hesitate', prompt: 'Do not ______ to ask for help.', answer: 'hesitate', sourceSentence: vocabularyItems[3].sourceSentence },
]
