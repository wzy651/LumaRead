import { BookOpen, Clock } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, ThemeToggle } from '../../components/ui'
import { reviewItems, vocabularyItems } from '../../mocks'
import { ReviewPrompt, type ReviewResult } from './ReviewPrompt'
import './review.css'

export function QuickReviewPage() {
  const navigate = useNavigate()
  const [activeIndex, setActiveIndex] = useState(0)
  const [answer, setAnswer] = useState('')
  const [result, setResult] = useState<ReviewResult>('answering')
  const [isComplete, setIsComplete] = useState(false)
  const completedHeadingRef = useRef<HTMLHeadingElement>(null)

  const activeItem = reviewItems[activeIndex]
  const vocabulary = activeItem
    ? vocabularyItems.find((item) => item.id === activeItem.vocabularyId)
    : undefined

  useEffect(() => {
    if (isComplete) completedHeadingRef.current?.focus({ preventScroll: true })
  }, [isComplete])

  function finishOrAdvance() {
    if (activeIndex >= reviewItems.length - 1) {
      setIsComplete(true)
      return
    }

    setActiveIndex((index) => index + 1)
    setAnswer('')
    setResult('answering')
  }

  function checkAnswer() {
    if (!activeItem || !answer.trim()) return

    const normalizedAnswer = answer.trim().toLocaleLowerCase()
    const normalizedExpected = activeItem.answer.trim().toLocaleLowerCase()
    setResult(normalizedAnswer === normalizedExpected ? 'correct' : 'incorrect')
  }

  return (
    <main className="review-page">
      <header className="review-header">
        <Link aria-label="LumaRead home" className="review-brand" to="/">
          <span aria-hidden="true" className="review-brand__mark">
            <BookOpen size={19} strokeWidth={1.8} />
          </span>
          <span>LumaRead</span>
        </Link>
        <div className="review-header__actions">
          <Button className="review-done" onClick={() => navigate('/')} variant="ghost">Done</Button>
          <ThemeToggle />
        </div>
      </header>

      <section aria-labelledby="review-title" className="review-content">
        <div className="review-intro">
          <p className="review-eyebrow">Quick review</p>
          <h1 id="review-title">A few expressions worth revisiting.</h1>
          <p className="review-subtitle">Take a quiet moment with them—or leave whenever you like.</p>
          <p className="review-duration"><Clock aria-hidden="true" size={16} /> About 3 min</p>
        </div>

        {isComplete || !activeItem ? (
          <section aria-live="polite" className="review-finished">
            <span aria-hidden="true" className="review-finished__icon">
              <BookOpen size={25} strokeWidth={1.6} />
            </span>
            <p className="review-eyebrow">That’s enough for now</p>
            <h2 ref={completedHeadingRef} tabIndex={-1}>A little practice, done.</h2>
            <p>You can return to your book whenever you feel like it.</p>
            <Button onClick={() => navigate('/')}>Done</Button>
          </section>
        ) : (
          <ReviewPrompt
            key={activeItem.id}
            answer={answer}
            isLast={activeIndex === reviewItems.length - 1}
            item={activeItem}
            onAnswerChange={setAnswer}
            onCheck={checkAnswer}
            onNext={finishOrAdvance}
            onReveal={() => setResult('revealed')}
            onSkip={finishOrAdvance}
            result={result}
            vocabulary={vocabulary}
          />
        )}
      </section>
    </main>
  )
}
