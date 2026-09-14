import { LockKeyhole } from 'lucide-react'
import { Progress } from '../../components/ui'
import type { Book } from '../../domain'
import { BookCover } from './BookCover'

interface RecentlyReadProps {
  books: Book[]
}

export function RecentlyRead({ books }: RecentlyReadProps) {
  return (
    <section aria-labelledby="recently-read-title" className="home-recent">
      <div className="home-section-heading">
        <div>
          <p className="home-eyebrow">Your shelf</p>
          <h2 id="recently-read-title">Recently read</h2>
        </div>
        <span className="home-section-heading__note">Library coming soon</span>
      </div>

      <div className="home-recent__grid">
        {books.map((book) => (
          <article className="home-recent-book" key={book.id}>
            <BookCover book={book} className="home-recent-book__cover" />
            <div className="home-recent-book__body">
              <div>
                <h3>{book.title}</h3>
                <p>{book.author}</p>
              </div>
              <div className="home-recent-book__progress">
                <span>{book.progress.locationLabel}</span>
                <Progress
                  label={`${book.title} reading progress: ${book.progress.completedPercent}%`}
                  value={book.progress.completedPercent}
                />
              </div>
              <span aria-label={`${book.title} preview coming soon`} className="home-text-link home-text-link--muted">
                Preview soon
                <LockKeyhole aria-hidden="true" size={14} strokeWidth={1.8} />
              </span>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
