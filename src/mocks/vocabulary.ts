import type { VocabularyItem } from '../domain'

export const vocabularyItems: VocabularyItem[] = [
  { id: 'reluctantly', term: 'reluctantly', pronunciation: '/rɪˈlʌktəntli/', definition: '不情愿地', sourceSentence: 'Hermione reluctantly followed him into the room.', contextNote: 'She followed, but did not really want to.', status: 'unknown', addedToLearning: false },
  { id: 'intervention', term: 'intervention', pronunciation: '/ˌɪntəˈvenʃən/', definition: '干预', sourceSentence: 'Had it not been for his intervention, the plan would have failed.', contextNote: 'An action that changed what happened.', status: 'active', addedToLearning: true },
  { id: 'glance', term: 'glance', pronunciation: '/ɡlɑːns/', definition: '瞥一眼', sourceSentence: 'She gave him a quick glance.', contextNote: 'A brief look.', status: 'recognized', addedToLearning: true },
  { id: 'hesitate', term: 'hesitate', pronunciation: '/ˈhezɪteɪt/', definition: '犹豫', sourceSentence: 'He did not hesitate before answering.', contextNote: 'To pause before deciding.', status: 'learning', addedToLearning: true },
  { id: 'murmur', term: 'murmur', pronunciation: '/ˈmɜːmə(r)/', definition: '低声说', sourceSentence: 'She murmured an answer.', contextNote: 'To speak very quietly.', status: 'unknown', addedToLearning: false },
]
