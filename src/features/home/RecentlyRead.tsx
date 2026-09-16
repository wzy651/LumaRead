import { ArrowRight } from 'lucide-react'
import { Progress } from '../../components/ui'
import type { HomeReadingItem } from './home-reading-service'
import { BookCover } from './BookCover'

interface RecentlyReadProps {
  books: HomeReadingItem[]
}

export function RecentlyRead({ books }: RecentlyReadProps) {
  if (!books.length) return null
  return (
    <section aria-labelledby="recently-read-title" className="home-recent">
      <div className="home-section-heading">
        <div>
          <p className="home-eyebrow">Your shelf</p>
          <h2 id="recently-read-title">Recently read</h2>
        </div>
        <span className="home-section-heading__note">Your reading history</span>
      </div>

      <div className="home-recent__grid">
        {books.map((book) => (
          <article className="home-recent-book" key={book.id}>
            <BookCover book={book} className="home-recent-book__cover" />
            <div className="home-recent-book__body">
              <div>
                <h3>{book.title}</h3>
                <p>{book.author ?? book.format}</p>
              </div>
              {(book.locationLabel || book.progressPercent !== undefined) && <div className="home-recent-book__progress">
                <span>{book.locationLabel}</span>
                {book.progressPercent !== undefined && <Progress
                  label={`${book.title} reading progress: ${book.progressPercent}%`}
                  value={book.progressPercent}
                />}
              </div>}
              <a className="home-text-link" href={book.route}>Continue <ArrowRight aria-hidden="true" size={14} /></a>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
