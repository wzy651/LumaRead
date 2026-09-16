import type { HomeReadingItem } from './home-reading-service'

interface BookCoverProps {
  book: Pick<HomeReadingItem, 'id' | 'title' | 'author' | 'coverUrl' | 'format'>
  className?: string
}

const coverTones = ['iris', 'forest', 'clay'] as const

function getCoverTone(bookId: string) {
  const seed = Array.from(bookId).reduce((total, character) => total + character.charCodeAt(0), 0)
  return coverTones[seed % coverTones.length]
}

export function BookCover({ book, className = '' }: BookCoverProps) {
  const classes = ['home-book-cover', className].filter(Boolean).join(' ')

  if (book.coverUrl) {
    return <img alt={`Cover of ${book.title}`} className={classes} src={book.coverUrl} />
  }

  return (
    <div aria-label={`Cover of ${book.title}`} className={classes} data-tone={getCoverTone(book.id)} role="img">
      <span aria-hidden="true" className="home-book-cover__ornament" />
      <span className="home-book-cover__title">{book.title}</span>
      <span className="home-book-cover__author">{book.author ?? book.format}</span>
    </div>
  )
}
