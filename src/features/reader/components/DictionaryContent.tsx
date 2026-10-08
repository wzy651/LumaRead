import { BookOpen, Check, Ellipsis, Plus } from 'lucide-react'
import type { VocabularyItem } from '../../../domain'
import { Button } from '../../../components/ui'

interface DictionaryContentProps {
  acknowledged: boolean
  addedToLearning: boolean
  item: VocabularyItem
  lookupCount: number
  moreVisible: boolean
  onAcknowledge: () => void
  onAddToLearning: () => void
  onToggleMore: () => void
}

export function DictionaryContent({ acknowledged, addedToLearning, item, lookupCount, moreVisible, onAcknowledge, onAddToLearning, onToggleMore }: DictionaryContentProps) {
  return (
    <div className="dictionary-content">
      <div className="dictionary-content__heading">
        <div>
          <h2>{item.term}</h2>
          <p className="dictionary-content__pronunciation">{item.pronunciation}</p>
        </div>
        <BookOpen aria-hidden="true" className="dictionary-content__mark" size={22} />
      </div>

      <p className="dictionary-content__definition" lang="zh-CN">{item.definition}</p>
      <blockquote>{item.sourceSentence}</blockquote>
      <p className="dictionary-content__context">{item.contextNote}</p>

      {moreVisible && (
        <div className="dictionary-content__more" lang="zh-CN">
          <p><span>累计查询</span>{lookupCount} 次</p>
          <p className="dictionary-content__reassurance">查词只帮助你继续阅读，不会自动生成复习任务。</p>
        </div>
      )}

      <div className="dictionary-content__actions" lang="zh-CN">
        <Button className="dictionary-content__understood" onClick={onAcknowledge} variant="primary">
          <Check aria-hidden="true" size={17} />
          {acknowledged ? '已懂' : '懂了'}
        </Button>
        <Button aria-pressed={addedToLearning} onClick={onAddToLearning} variant="secondary">
          {addedToLearning ? <Check aria-hidden="true" size={17} /> : <Plus aria-hidden="true" size={17} />}
          {addedToLearning ? '已加入学习' : '加入学习'}
        </Button>
        <Button aria-expanded={moreVisible} onClick={onToggleMore} variant="ghost">
          <Ellipsis aria-hidden="true" size={16} />
          {moreVisible ? '收起' : '更多'}
        </Button>
      </div>
    </div>
  )
}
