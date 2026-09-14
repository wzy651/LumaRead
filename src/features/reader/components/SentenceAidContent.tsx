import { useEffect, useState } from 'react'
import { Languages, ListTree, Sparkles, Volume2 } from 'lucide-react'
import type { SentenceAidFixture } from '../fixtures/reader-content'

type AidMode = 'translation' | 'explain' | 'simplify'

interface SentenceAidContentProps {
  aid: SentenceAidFixture
}

const modes: Array<{ id: AidMode; label: string; icon: typeof Languages }> = [
  { id: 'translation', label: '翻译', icon: Languages },
  { id: 'explain', label: 'Explain', icon: ListTree },
  { id: 'simplify', label: 'Simplify English', icon: Sparkles },
]

export function SentenceAidContent({ aid }: SentenceAidContentProps) {
  const [mode, setMode] = useState<AidMode>('explain')
  const [showMore, setShowMore] = useState(false)
  const [isReading, setIsReading] = useState(false)

  useEffect(() => {
    if (!isReading) return
    const timer = window.setTimeout(() => setIsReading(false), 1800)
    return () => window.clearTimeout(timer)
  }, [isReading])

  return (
    <div className="sentence-aid">
      <p className="sentence-aid__source">{aid.sentence}</p>

      <div aria-label="句子理解方式" className="sentence-aid__modes" role="group">
        {modes.map(({ id, label, icon: Icon }) => (
          <button
            aria-pressed={mode === id}
            className={mode === id ? 'is-active' : ''}
            key={id}
            onClick={() => setMode(id)}
            type="button"
          >
            <Icon aria-hidden="true" size={16} />
            {label}
          </button>
        ))}
        <button aria-pressed={isReading} onClick={() => setIsReading((current) => !current)} type="button">
          <Volume2 aria-hidden="true" size={16} />
          {isReading ? '朗读中…' : '朗读'}
        </button>
      </div>

      <div aria-live="polite" className="sentence-aid__answer">
        {mode === 'translation' && (
          <>
            <span>意思</span>
            <p lang="zh-CN">{aid.translation}</p>
          </>
        )}
        {mode === 'explain' && (
          <>
            <span>意思</span>
            <p lang="zh-CN">{aid.meaning}</p>
            <span>结构</span>
            <p className="sentence-aid__structure">{aid.structure}<br />{aid.equivalentStructure}</p>
            {showMore && <p className="sentence-aid__detail" lang="zh-CN">{aid.detailedExplanation}</p>}
            <button aria-expanded={showMore} className="sentence-aid__more" onClick={() => setShowMore((current) => !current)} type="button">
              {showMore ? 'Show Less' : 'Explain More'}
            </button>
          </>
        )}
        {mode === 'simplify' && (
          <>
            <span>Simple English</span>
            <p>{aid.simplifiedEnglish}</p>
          </>
        )}
      </div>
      {isReading && <p className="sentence-aid__mock-status" role="status">Mock pronunciation is playing.</p>}
    </div>
  )
}
