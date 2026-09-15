import { BookOpen, Bookmark, Check, Clock, FileText, Search } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, ThemeToggle } from '../../components/ui'
import { sessionSummary } from '../../mocks'
import { SummaryMetric } from './SummaryMetric'
import './session-summary.css'

export function SessionSummaryPage() {
  const navigate = useNavigate()
  const formattedWords = new Intl.NumberFormat('en-US').format(sessionSummary.wordsRead)

  return (
    <main className="summary-page">
      <header className="summary-header">
        <Link aria-label="LumaRead home" className="summary-brand" to="/">
          <span aria-hidden="true" className="summary-brand__mark">
            <BookOpen size={19} strokeWidth={1.8} />
          </span>
          <span>LumaRead</span>
        </Link>
        <ThemeToggle />
      </header>

      <section aria-labelledby="summary-title" className="summary-card">
        <span aria-hidden="true" className="summary-check">
          <Check size={27} strokeWidth={1.8} />
        </span>
        <p className="summary-eyebrow">Reading saved</p>
        <h1 id="summary-title">Nice reading session</h1>
        <p className="summary-lede">A quiet stretch of the story, all yours.</p>

        <dl className="summary-metrics">
          <SummaryMetric icon={<Clock />} label="Minutes" value={sessionSummary.durationMinutes.toString()} />
          <SummaryMetric icon={<FileText />} label="Words" value={formattedWords} />
          <SummaryMetric icon={<Search />} label="Lookups" value={sessionSummary.lookupCount.toString()} />
        </dl>

        <div className="summary-expression-note">
          <Bookmark aria-hidden="true" size={19} strokeWidth={1.7} />
          <p><strong>{sessionSummary.expressionsToReview} expressions</strong> may be worth remembering.</p>
        </div>

        <div className="summary-actions">
          <Button onClick={() => navigate('/')}>Done</Button>
          <Button onClick={() => navigate('/review')} variant="secondary">
            Review {sessionSummary.expressionsToReview} expressions
          </Button>
        </div>
      </section>
    </main>
  )
}
