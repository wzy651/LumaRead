import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from 'react'
import { ArrowLeft, BookOpen, Check, Minus, Plus, Sparkles } from 'lucide-react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { Progress, ThemeToggle } from '../../components/ui'
import { MEDIA_QUERIES, useMediaQuery } from '../../app/responsive'
import { books, currentBook, lookupEvents, vocabularyItems } from '../../mocks'
import type { VocabularyItem } from '../../domain'
import { AdaptivePanel } from './components/AdaptivePanel'
import { DictionaryContent } from './components/DictionaryContent'
import { InteractiveSentence } from './components/InteractiveSentence'
import { SentenceAidContent } from './components/SentenceAidContent'
import { readerChapter, sentenceAids, type ReaderSegment } from './fixtures/reader-content'
import './reader.css'

type ActivePanel =
  | { anchor: HTMLElement; kind: 'dictionary'; vocabularyId: string }
  | { aidId: string; anchor: HTMLElement; kind: 'sentence' }

function addToSet(values: Set<string>, value: string): Set<string> {
  const next = new Set(values)
  next.add(value)
  return next
}

function ReaderWord({
  displayText,
  item,
  learnedReminder,
  onOpen,
}: {
  displayText: string
  item: VocabularyItem
  learnedReminder?: boolean
  onOpen: (item: VocabularyItem, anchor: HTMLElement) => void
}) {
  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    onOpen(item, event.currentTarget)
  }

  return (
    <button
      className={'reader-word' + (learnedReminder ? ' reader-word--reminder' : '')}
      onClick={handleClick}
      type="button"
    >
      {displayText}
    </button>
  )
}

export function ReaderPage() {
  const { bookId } = useParams()
  const isMobile = useMediaQuery(MEDIA_QUERIES.mobile)
  const [activePanel, setActivePanel] = useState<ActivePanel | null>(null)
  const [chromeVisible, setChromeVisible] = useState(true)
  const [fontScale, setFontScale] = useState(1)
  const chromeHideTimerRef = useRef<number | undefined>(undefined)
  const [lookupCounts, setLookupCounts] = useState<Record<string, number>>(() => {
    const counts: Record<string, number> = {}
    for (const event of lookupEvents) counts[event.vocabularyId] = (counts[event.vocabularyId] ?? 0) + 1
    return counts
  })
  const [acknowledgedIds, setAcknowledgedIds] = useState<Set<string>>(() => new Set())
  const [learningIds, setLearningIds] = useState<Set<string>>(
    () => new Set(vocabularyItems.filter((item) => item.addedToLearning).map((item) => item.id)),
  )
  const [moreVisible, setMoreVisible] = useState(false)

  const vocabularyById = useMemo(
    () => new Map(vocabularyItems.map((item) => [item.id, item])),
    [],
  )

  const revealChrome = useCallback(() => {
    if (chromeHideTimerRef.current !== undefined) window.clearTimeout(chromeHideTimerRef.current)
    setChromeVisible(true)
    chromeHideTimerRef.current = window.setTimeout(() => {
      const focusedElement = document.activeElement
      if (focusedElement instanceof HTMLElement && focusedElement.closest('.reader-topbar, .reader-toolbar')) return
      setChromeVisible(false)
    }, 3200)
  }, [])

  useEffect(() => {
    chromeHideTimerRef.current = window.setTimeout(() => {
      const focusedElement = document.activeElement
      if (focusedElement instanceof HTMLElement && focusedElement.closest('.reader-topbar, .reader-toolbar')) return
      setChromeVisible(false)
    }, 3200)
    window.addEventListener('focusin', revealChrome)
    window.addEventListener('keydown', revealChrome)
    window.addEventListener('pointerdown', revealChrome, { passive: true })
    window.addEventListener('pointermove', revealChrome, { passive: true })
    window.addEventListener('scroll', revealChrome, { capture: true, passive: true })

    return () => {
      if (chromeHideTimerRef.current !== undefined) window.clearTimeout(chromeHideTimerRef.current)
      window.removeEventListener('focusin', revealChrome)
      window.removeEventListener('keydown', revealChrome)
      window.removeEventListener('pointerdown', revealChrome)
      window.removeEventListener('pointermove', revealChrome)
      window.removeEventListener('scroll', revealChrome, true)
    }
  }, [revealChrome])

  if (!bookId || !books.some((book) => book.id === bookId) || bookId !== readerChapter.bookId) {
    return <Navigate replace to={'/reader/' + currentBook.id} />
  }

  function openDictionary(item: VocabularyItem, anchor: HTMLElement) {
    setLookupCounts((current) => ({ ...current, [item.id]: (current[item.id] ?? 0) + 1 }))
    setMoreVisible(false)
    setActivePanel({ anchor, kind: 'dictionary', vocabularyId: item.id })
  }

  function openSentence(aidId: string, anchor: HTMLElement) {
    setActivePanel({ aidId, anchor, kind: 'sentence' })
  }

  function renderSegment(segment: ReaderSegment, paragraphIndex: number, segmentIndex: number) {
    const key = paragraphIndex + '-' + segmentIndex
    if (segment.kind === 'text') return <span key={key}>{segment.text}</span>

    if (segment.kind === 'word') {
      const item = vocabularyById.get(segment.vocabularyId)
      if (!item) return <span key={key}>{segment.text}</span>
      return (
        <ReaderWord
          displayText={segment.text}
          item={item}
          key={key}
          learnedReminder={segment.learnedReminder}
          onOpen={openDictionary}
        />
      )
    }

    return (
      <InteractiveSentence key={key} onOpen={(anchor) => openSentence(segment.aidId, anchor)}>
        {segment.text}
      </InteractiveSentence>
    )
  }

  const activeVocabulary = activePanel?.kind === 'dictionary'
    ? vocabularyById.get(activePanel.vocabularyId)
    : undefined
  const activeSentenceAid = activePanel?.kind === 'sentence'
    ? sentenceAids[activePanel.aidId]
    : undefined

  return (
    <div className="reader-shell">
      <header className="reader-topbar">
        <Link aria-label="Back to home" className="reader-icon-link" to="/">
          <ArrowLeft aria-hidden="true" size={19} />
        </Link>
        <div className="reader-book-identity">
          <span>{currentBook.title}</span>
          <small>{readerChapter.chapterLabel}</small>
        </div>
        <div className="reader-topbar__progress">
          <span>{currentBook.progress.completedPercent}%</span>
          <Progress
            label={'Reading progress for ' + currentBook.title}
            value={currentBook.progress.completedPercent}
          />
        </div>
        <ThemeToggle />
      </header>

      <main className="reader-main">
        <article
          aria-labelledby="reader-chapter-title"
          className="reader-article"
          style={{ '--reader-font-scale': fontScale } as CSSProperties}
        >
          <header className="reader-chapter-heading">
            <div className="reader-chapter-heading__mark">
              <BookOpen aria-hidden="true" size={16} />
              {readerChapter.chapterLabel}
            </div>
            <h1 id="reader-chapter-title">{readerChapter.chapterTitle}</h1>
            <p>{readerChapter.readingHint}</p>
          </header>

          <div className="reader-prose">
            {readerChapter.paragraphs.map((paragraph, paragraphIndex) => (
              <p key={paragraphIndex}>
                {paragraph.map((segment, segmentIndex) => renderSegment(segment, paragraphIndex, segmentIndex))}
              </p>
            ))}
          </div>

          <footer className="reader-chapter-end">
            <Sparkles aria-hidden="true" size={15} />
            <span>A quiet place to stop, whenever you are ready.</span>
          </footer>
        </article>
      </main>

      <div aria-label="Reading controls" className={`reader-toolbar reader-chrome--${chromeVisible ? 'visible' : 'hidden'}`} role="toolbar">
        <div className="reader-font-controls">
          <button
            aria-label="Decrease text size"
            disabled={fontScale <= 0.9}
            onClick={() => setFontScale((current) => Math.max(0.9, Number((current - 0.05).toFixed(2))))}
            type="button"
          >
            <Minus aria-hidden="true" size={17} />
          </button>
          <span aria-hidden="true">Aa</span>
          <button
            aria-label="Increase text size"
            disabled={fontScale >= 1.15}
            onClick={() => setFontScale((current) => Math.min(1.15, Number((current + 0.05).toFixed(2))))}
            type="button"
          >
            <Plus aria-hidden="true" size={17} />
          </button>
        </div>
        <Link className="reader-finish-link" to="/session-summary">
          <Check aria-hidden="true" size={17} />
          Finish for now
        </Link>
      </div>

      {activePanel && activeVocabulary && (
        <AdaptivePanel
          anchorElement={activePanel.anchor}
          isMobile={isMobile}
          label="Quick meaning"
          onClose={() => setActivePanel(null)}
          variant="dictionary"
        >
          <DictionaryContent
            acknowledged={acknowledgedIds.has(activeVocabulary.id)}
            addedToLearning={learningIds.has(activeVocabulary.id)}
            item={activeVocabulary}
            lookupCount={lookupCounts[activeVocabulary.id] ?? 1}
            moreVisible={moreVisible}
            onAcknowledge={() => setAcknowledgedIds((current) => addToSet(current, activeVocabulary.id))}
            onAddToLearning={() => setLearningIds((current) => addToSet(current, activeVocabulary.id))}
            onToggleMore={() => setMoreVisible((current) => !current)}
          />
        </AdaptivePanel>
      )}

      {activePanel && activeSentenceAid && (
        <AdaptivePanel
          anchorElement={activePanel.anchor}
          isMobile={isMobile}
          label="Sentence help"
          onClose={() => setActivePanel(null)}
          variant="sentence"
        >
          <SentenceAidContent aid={activeSentenceAid} />
        </AdaptivePanel>
      )}
    </div>
  )
}
