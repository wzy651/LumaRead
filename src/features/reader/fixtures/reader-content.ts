export type ReaderSegment =
  | { kind: 'text'; text: string }
  | { kind: 'word'; text: string; vocabularyId: string; learnedReminder?: boolean }
  | { kind: 'sentence'; text: string; aidId: string }

export interface SentenceAidFixture {
  id: string
  sentence: string
  translation: string
  meaning: string
  structure: string
  equivalentStructure: string
  simplifiedEnglish: string
  detailedExplanation: string
}

export interface ReaderChapterFixture {
  bookId: string
  chapterLabel: string
  chapterTitle: string
  readingHint: string
  paragraphs: ReaderSegment[][]
}

export const sentenceAids: Record<string, SentenceAidFixture> = {
  'darcy-intervention': {
    id: 'darcy-intervention',
    sentence: "Had it not been for Darcy's intervention, the misunderstanding might have lasted until morning.",
    translation: '如果不是达西出面干预，这场误会或许会一直持续到早晨。',
    meaning: '如果不是达西的干预……',
    structure: 'Had it not been for…',
    equivalentStructure: '= If it had not been for…',
    simplifiedEnglish: 'Darcy stepped in, so the misunderstanding was cleared up before morning.',
    detailedExplanation: '这是省略 if 的虚拟条件句。把 had 提到主语 it 前面，含义不变；might have lasted 表示过去本来可能发生、但最终没有发生的结果。',
  },
}

export const readerChapter: ReaderChapterFixture = {
  bookId: 'pride-and-prejudice',
  chapterLabel: 'Chapter Twelve',
  chapterTitle: 'A Quiet Understanding',
  readingHint: 'Tap a word for meaning. Select the underlined sentence for a little help.',
  paragraphs: [
    [
      { kind: 'text', text: 'By evening, the rain had softened to a faint tapping against the windows. The drawing room was warmer than the hall, yet the conversation inside had acquired the careful stillness that follows an awkward confession.' },
    ],
    [
      { kind: 'text', text: 'Elizabeth ' },
      { kind: 'word', text: 'reluctantly', vocabularyId: 'reluctantly' },
      { kind: 'text', text: ' followed Jane into the small drawing room. She would rather have walked another mile in the damp garden than explain what had passed between herself and Mr. Darcy, but Jane’s gentle patience made silence feel unnecessarily severe.' },
    ],
    [
      { kind: 'text', text: 'At the far window stood Darcy himself, looking out across the dark lawn. Elizabeth cast Darcy a quick ' },
      { kind: 'word', text: 'glance', vocabularyId: 'glance', learnedReminder: true },
      { kind: 'text', text: ' before she answered. His expression offered neither triumph nor complaint; it held only the grave attention of someone prepared to be misunderstood.' },
    ],
    [
      { kind: 'sentence', text: "Had it not been for Darcy's intervention, the misunderstanding might have lasted until morning.", aidId: 'darcy-intervention' },
      { kind: 'text', text: ' He had spoken only once, and with so little ceremony that the importance of his words became clear only after the room had fallen quiet.' },
    ],
    [
      { kind: 'text', text: 'Jane did not ' },
      { kind: 'word', text: 'hesitate', vocabularyId: 'hesitate', learnedReminder: true },
      { kind: 'text', text: ' before offering a gentler account. She supposed that everyone had meant well, though good intentions, she admitted, did not always arrive in their most agreeable form.' },
    ],
    [
      { kind: 'text', text: 'Elizabeth smiled despite herself. “That is a very Jane-like conclusion,” she said. Jane ' },
      { kind: 'word', text: 'murmured', vocabularyId: 'murmur' },
      { kind: 'text', text: ' that the matter was best left alone, and moved a lamp nearer the sofa as if a little more light might settle everything.' },
    ],
    [
      { kind: 'text', text: 'Darcy turned from the window. “I ought to have explained sooner,” he said. There was no elaborate defence in his manner, and this simplicity disarmed the reply Elizabeth had been preparing. For once, wit seemed a poor substitute for honesty.' },
    ],
    [
      { kind: 'text', text: 'They spoke then without perfect ease, but with enough. Outside, the last drops slipped from the leaves, and the path beyond the glass began to show beneath a pale strip of sky. Nothing had been entirely resolved; still, the evening no longer felt like a room with every door closed.' },
    ],
    [
      { kind: 'text', text: 'When Elizabeth finally rose, Jane squeezed her hand. Darcy stepped aside to let them pass, and the small courtesy, ordinary as it was, carried none of the uncertainty it would have held an hour before.' },
    ],
  ],
}
