import type { VocabularyItem } from '../domain'

export const vocabularyItems: VocabularyItem[] = [
  { id: 'reluctantly', term: 'reluctantly', pronunciation: '/rɪˈlʌktəntli/', definition: '不情愿地；勉强地', sourceSentence: 'Elizabeth reluctantly followed Jane into the small drawing room.', contextNote: 'She followed, although she would rather have stayed away.', status: 'unknown', addedToLearning: false },
  { id: 'intervention', term: 'intervention', pronunciation: '/ˌɪntəˈvenʃən/', definition: '干预；介入', sourceSentence: "Had it not been for Darcy's intervention, the misunderstanding might have lasted until morning.", contextNote: 'Darcy stepped in and changed what would otherwise have happened.', status: 'active', addedToLearning: true },
  { id: 'glance', term: 'glance', pronunciation: '/ɡlɑːns/', definition: '瞥一眼', sourceSentence: 'Elizabeth cast Darcy a quick glance before she answered.', contextNote: 'A brief look rather than a careful one.', status: 'recognized', addedToLearning: true },
  { id: 'hesitate', term: 'hesitate', pronunciation: '/ˈhezɪteɪt/', definition: '犹豫', sourceSentence: 'Jane did not hesitate before offering a gentler account.', contextNote: 'To pause because you are uncertain.', status: 'learning', addedToLearning: true },
  { id: 'murmur', term: 'murmur', pronunciation: '/ˈmɜːmə(r)/', definition: '低声说', sourceSentence: 'Jane murmured that the matter was best left alone.', contextNote: 'To speak in a very quiet voice.', status: 'unknown', addedToLearning: false },
]
