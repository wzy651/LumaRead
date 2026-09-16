import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card, Progress } from '../../components/ui'
import type { HomeReadingItem } from './home-reading-service'
import { BookCover } from './BookCover'

interface ContinueReadingCardProps {
  item?: HomeReadingItem
}

export function ContinueReadingCard({ item }: ContinueReadingCardProps) {
  if (!item) return <Card as="section" aria-labelledby="continue-reading-title" className="home-continue-card home-continue-card--empty"><div className="home-continue-card__body"><p className="home-eyebrow">Your reading</p><h2 id="continue-reading-title">Choose something to read</h2><p className="home-continue-card__author">Your next quiet chapter is in the library.</p><Link className="home-primary-action" to="/library">Open Library<ArrowRight aria-hidden="true" size={18} /></Link></div></Card>
  return (
    <Card as="section" aria-labelledby="continue-reading-title" className="home-continue-card">
      <div aria-hidden="true" className="home-continue-card__glow" />
      <BookCover book={item} className="home-continue-card__cover" />

      <div className="home-continue-card__body">
        <p className="home-eyebrow">Continue reading</p>
        <h2 id="continue-reading-title">{item.title}</h2>
        <p className="home-continue-card__author">{item.author ?? item.format}</p>

        {(item.locationLabel || item.progressPercent !== undefined) && <div className="home-continue-card__progress">
          <div className="home-progress-copy">
            <span>{item.locationLabel}</span>
            <span>{item.progressPercent === undefined ? '' : `${item.progressPercent}%`}</span>
          </div>
          <Progress
            label={`${item.title} reading progress: ${item.progressPercent}%`}
            value={item.progressPercent ?? 0}
          />
        </div>}

        <Link className="home-primary-action" to={item.route}>
          Keep reading
          <ArrowRight aria-hidden="true" size={18} strokeWidth={1.9} />
        </Link>
      </div>
    </Card>
  )
}
