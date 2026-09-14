import { ArrowRight, Clock3, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card } from '../../components/ui'

export function QuickReviewCard() {
  return (
    <Card as="aside" aria-labelledby="quick-review-title" className="home-review-card">
      <div aria-hidden="true" className="home-review-card__icon">
        <Sparkles size={21} strokeWidth={1.7} />
      </div>
      <div>
        <p className="home-eyebrow">Whenever you feel like it</p>
        <h2 id="quick-review-title">A gentle review</h2>
        <p className="home-review-card__description">
          Revisit a few useful expressions from your reading. No streaks, no pressure.
        </p>
      </div>
      <div className="home-review-card__time">
        <Clock3 aria-hidden="true" size={17} strokeWidth={1.8} />
        About 3 minutes
      </div>
      <Link className="home-secondary-action" to="/review">
        Start quick review
        <ArrowRight aria-hidden="true" size={17} strokeWidth={1.9} />
      </Link>
      <p className="home-review-card__reassurance">Or simply keep reading — both are good choices.</p>
    </Card>
  )
}
