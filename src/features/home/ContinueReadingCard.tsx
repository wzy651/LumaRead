import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card, Progress } from '../../components/ui'
import type { Book } from '../../domain'
import { BookCover } from './BookCover'

interface ContinueReadingCardProps {
  book: Book
}

export function ContinueReadingCard({ book }: ContinueReadingCardProps) {
  return (
    <Card as="section" aria-labelledby="continue-reading-title" className="home-continue-card">
      <div aria-hidden="true" className="home-continue-card__glow" />
      <BookCover book={book} className="home-continue-card__cover" />

      <div className="home-continue-card__body">
        <p className="home-eyebrow">Continue reading</p>
        <h2 id="continue-reading-title">{book.title}</h2>
        <p className="home-continue-card__author">{book.author}</p>

        <div className="home-continue-card__progress">
          <div className="home-progress-copy">
            <span>{book.progress.locationLabel}</span>
            <span>{book.progress.completedPercent}%</span>
          </div>
          <Progress
            label={`${book.title} reading progress: ${book.progress.completedPercent}%`}
            value={book.progress.completedPercent}
          />
        </div>

        <Link className="home-primary-action" to={`/reader/${book.id}`}>
          Keep reading
          <ArrowRight aria-hidden="true" size={18} strokeWidth={1.9} />
        </Link>
      </div>
    </Card>
  )
}
