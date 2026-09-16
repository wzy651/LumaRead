import { useMemo, useState, type CSSProperties, type MouseEvent } from 'react'
import { BookOpen, Sparkles } from 'lucide-react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { MEDIA_QUERIES, useMediaQuery } from '../../app/responsive'
import { books, currentBook, lookupEvents, vocabularyItems } from '../../mocks'
import type { VocabularyItem } from '../../domain'
import { AdaptivePanel } from './components/AdaptivePanel'
import { DictionaryContent } from './components/DictionaryContent'
import { InteractiveSentence } from './components/InteractiveSentence'
import { ReaderChrome } from './components/ReaderChrome'
import { ReaderMoreMenu } from './components/ReaderMoreMenu'
import { ReadingSettingsPanel } from './components/ReadingSettingsPanel'
import { SentenceAidContent } from './components/SentenceAidContent'
import { readerChapter, sentenceAids, type ReaderSegment } from './fixtures/reader-content'
import { useReaderChromeVisibility } from './useReaderChromeVisibility'
import { useReaderSettings } from './useReaderSettings'
import { ImportedDocumentReader } from './documents/ImportedDocumentReader'
import { readerLanguage, resolveReaderLayout } from './readerLayout'
import './reader.css'

type ActivePanel =
  | { anchor: HTMLElement; kind: 'dictionary'; vocabularyId: string }
  | { aidId: string; anchor: HTMLElement; kind: 'sentence' }
  | { anchor: HTMLElement; kind: 'settings' }
  | { anchor: HTMLElement; kind: 'more' }

function addToSet(values: Set<string>, value: string): Set<string> { const next = new Set(values); next.add(value); return next }

function ReaderWord({ displayText, item, learnedReminder, onOpen }: { displayText: string; item: VocabularyItem; learnedReminder?: boolean; onOpen: (item: VocabularyItem, anchor: HTMLElement) => void }) {
  return <button className={'reader-word' + (learnedReminder ? ' reader-word--reminder' : '')} onClick={(event: MouseEvent<HTMLButtonElement>) => onOpen(item, event.currentTarget)} type="button">{displayText}</button>
}

export function ReaderPage() {
  const { bookId } = useParams()
  const navigate = useNavigate()
  const isMobile = useMediaQuery(MEDIA_QUERIES.mobile)
  const [activePanel, setActivePanel] = useState<ActivePanel | null>(null)
  const { settings, setSettings } = useReaderSettings()
  const { chromeRef, hide, reveal, visible } = useReaderChromeVisibility({ isMobile, overlayOpen: activePanel !== null })
  const [lookupCounts, setLookupCounts] = useState<Record<string, number>>(() => Object.fromEntries(vocabularyItems.map((item) => [item.id, lookupEvents.filter((event) => event.vocabularyId === item.id).length])))
  const [acknowledgedIds, setAcknowledgedIds] = useState<Set<string>>(() => new Set())
  const [learningIds, setLearningIds] = useState<Set<string>>(() => new Set(vocabularyItems.filter((item) => item.addedToLearning).map((item) => item.id)))
  const [moreVisible, setMoreVisible] = useState(false)
  const vocabularyById = useMemo(() => new Map(vocabularyItems.map((item) => [item.id, item])), [])

  if (bookId && !books.some((book) => book.id === bookId)) return <ImportedDocumentReader documentId={bookId} />
  if (!bookId || bookId !== readerChapter.bookId) return <Navigate replace to={'/reader/' + currentBook.id} />

  function exitReader() { if (window.history.length > 1) navigate(-1); else navigate('/') }
  function openDictionary(item: VocabularyItem, anchor: HTMLElement) { setLookupCounts((current) => ({ ...current, [item.id]: (current[item.id] ?? 0) + 1 })); setMoreVisible(false); setActivePanel({ anchor, kind: 'dictionary', vocabularyId: item.id }) }
  function openSentence(aidId: string, anchor: HTMLElement) { setActivePanel({ aidId, anchor, kind: 'sentence' }) }
  function openChromePanel(kind: 'settings' | 'more', anchor: HTMLButtonElement) { setActivePanel({ anchor, kind }) }
  function handleReadingAreaClick(event: MouseEvent<HTMLElement>) {
    if (event.defaultPrevented || window.getSelection()?.toString().trim()) return
    const target = event.target as HTMLElement
    if (target.closest('.reader-word, .reader-sentence-target, .reader-panel')) return
    if (isMobile && (target === event.currentTarget || target.classList.contains('reader-article'))) {
      if (visible) hide()
      else reveal()
    }
    else if (target === event.currentTarget) reveal()
  }
  function renderSegment(segment: ReaderSegment, paragraphIndex: number, segmentIndex: number) {
    const key = `${paragraphIndex}-${segmentIndex}`
    if (segment.kind === 'text') return <span key={key}>{segment.text}</span>
    if (segment.kind === 'word') { const item = vocabularyById.get(segment.vocabularyId); return item ? <ReaderWord displayText={segment.text} item={item} key={key} learnedReminder={segment.learnedReminder} onOpen={openDictionary} /> : <span key={key}>{segment.text}</span> }
    return <InteractiveSentence key={key} onOpen={(anchor) => openSentence(segment.aidId, anchor)}>{segment.text}</InteractiveSentence>
  }
  const activeVocabulary = activePanel?.kind === 'dictionary' ? vocabularyById.get(activePanel.vocabularyId) : undefined
  const activeSentenceAid = activePanel?.kind === 'sentence' ? sentenceAids[activePanel.aidId] : undefined
  const layout = resolveReaderLayout(settings, isMobile)

  return <div className="reader-shell">
    <ReaderChrome bookTitle={currentBook.title} chapterLabel={readerChapter.chapterLabel} chromeRef={chromeRef} isMobile={isMobile} onBack={exitReader} onMore={(anchor) => openChromePanel('more', anchor)} onSettings={(anchor) => openChromePanel('settings', anchor)} visible={visible} />
    <main className="reader-main" onClick={handleReadingAreaClick}>
      <article aria-labelledby="reader-chapter-title" className={`reader-article ${layout.className}`} lang={readerLanguage('en')} style={layout.styleVariables as CSSProperties}>
        <header className="reader-chapter-heading"><div className="reader-chapter-heading__mark"><BookOpen aria-hidden="true" size={16} />{readerChapter.chapterLabel}</div><h1 id="reader-chapter-title">{readerChapter.chapterTitle}</h1><p>{readerChapter.readingHint}</p></header>
        <div className="reader-prose">{readerChapter.paragraphs.map((paragraph, paragraphIndex) => <p key={paragraphIndex}>{paragraph.map((segment, segmentIndex) => renderSegment(segment, paragraphIndex, segmentIndex))}</p>)}</div>
        <footer className="reader-chapter-end"><Sparkles aria-hidden="true" size={15} /><span>A quiet place to stop, whenever you are ready.</span></footer>
      </article>
    </main>
    {activePanel?.kind === 'settings' && <AdaptivePanel anchorElement={activePanel.anchor} isMobile={isMobile} label="Reading settings" onClose={() => setActivePanel(null)} variant="settings"><ReadingSettingsPanel settings={settings} setSettings={setSettings} /></AdaptivePanel>}
    {activePanel?.kind === 'more' && <AdaptivePanel anchorElement={activePanel.anchor} isMobile={isMobile} label="More reader options" onClose={() => setActivePanel(null)} variant="more"><ReaderMoreMenu /></AdaptivePanel>}
    {activePanel && activeVocabulary && <AdaptivePanel anchorElement={activePanel.anchor} isMobile={isMobile} label="Quick meaning" onClose={() => setActivePanel(null)} variant="dictionary"><DictionaryContent acknowledged={acknowledgedIds.has(activeVocabulary.id)} addedToLearning={learningIds.has(activeVocabulary.id)} item={activeVocabulary} lookupCount={lookupCounts[activeVocabulary.id] ?? 1} moreVisible={moreVisible} onAcknowledge={() => setAcknowledgedIds((current) => addToSet(current, activeVocabulary.id))} onAddToLearning={() => setLearningIds((current) => addToSet(current, activeVocabulary.id))} onToggleMore={() => setMoreVisible((current) => !current)} /></AdaptivePanel>}
    {activePanel && activeSentenceAid && <AdaptivePanel anchorElement={activePanel.anchor} isMobile={isMobile} label="Sentence help" onClose={() => setActivePanel(null)} variant="sentence"><SentenceAidContent aid={activeSentenceAid} /></AdaptivePanel>}
  </div>
}
