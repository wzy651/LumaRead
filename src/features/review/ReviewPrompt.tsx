import { ArrowRight, Eye, SkipForward } from 'lucide-react'
import { useEffect, useRef, type FormEvent } from 'react'
import { Button } from '../../components/ui'
import type { ReviewItem, VocabularyItem } from '../../domain'

export type ReviewResult = 'answering' | 'correct' | 'incorrect' | 'revealed'

interface ReviewPromptProps {
  answer: string
  isLast: boolean
  item: ReviewItem
  onAnswerChange: (answer: string) => void
  onCheck: () => void
  onNext: () => void
  onReveal: () => void
  onSkip: () => void
  result: ReviewResult
  vocabulary?: VocabularyItem
}

export function ReviewPrompt({
  answer,
  isLast,
  item,
  onAnswerChange,
  onCheck,
  onNext,
  onReveal,
  onSkip,
  result,
  vocabulary,
}: ReviewPromptProps) {
  const hasFeedback = result !== 'answering'
  const cardRef = useRef<HTMLElement>(null)
  const promptRef = useRef<HTMLHeadingElement>(null)
  const promptId = `prompt-${item.id}`
  const feedback = result === 'correct'
    ? 'That’s it.'
    : result === 'incorrect'
      ? 'Almost — take a look at the expression.'
      : result === 'revealed'
        ? 'Here it is in context.'
        : ''

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (hasFeedback) cardRef.current?.querySelector<HTMLButtonElement>('[data-review-primary="true"]')?.focus()
      else promptRef.current?.focus({ preventScroll: true })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [hasFeedback, item.id])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (hasFeedback) onNext()
    else onCheck()
  }

  return (
    <article className="review-card" ref={cardRef}>
      <p className="review-card__label">Complete the sentence</p>
      <h2 aria-label={item.prompt.replace(/_+/, 'blank')} className="review-card__prompt" id={promptId} ref={promptRef} tabIndex={-1}>{item.prompt}</h2>

      <form className="review-form" onSubmit={handleSubmit}>
        <label className="review-input-label" htmlFor={`answer-${item.id}`}>Your answer</label>
        <input
          aria-describedby={`${promptId} feedback-${item.id}`}
          aria-invalid={result === 'incorrect' ? 'true' : undefined}
          autoCapitalize="none"
          autoComplete="off"
          className="review-input"
          id={`answer-${item.id}`}
          onChange={(event) => onAnswerChange(event.target.value)}
          placeholder="Type the missing expression"
          readOnly={hasFeedback}
          spellCheck={false}
          value={answer}
        />

        <div aria-live="polite" className="review-feedback" id={`feedback-${item.id}`}>
          {hasFeedback && (
            <div className={`review-feedback__message review-feedback__message--${result}`}>
              <p>{feedback}</p>
              <strong>{item.answer}</strong>
              {vocabulary && <span>{vocabulary.pronunciation} · <span lang="zh-CN">{vocabulary.definition}</span></span>}
            </div>
          )}
        </div>

        <div className="review-actions">
          {hasFeedback ? (
            <Button className="review-actions__primary" data-review-primary="true" type="submit">
              {isLast ? 'Finish' : 'Next expression'} <ArrowRight aria-hidden="true" size={17} />
            </Button>
          ) : (
            <>
              <Button className="review-actions__primary" disabled={!answer.trim()} type="submit">Check</Button>
              <div className="review-actions__quiet">
                <Button onClick={onReveal} variant="ghost"><Eye aria-hidden="true" size={17} /> Reveal</Button>
                <Button onClick={onSkip} variant="ghost"><SkipForward aria-hidden="true" size={17} /> Skip</Button>
              </div>
            </>
          )}
        </div>
      </form>
    </article>
  )
}
