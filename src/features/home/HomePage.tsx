import { ThemeToggle } from '../../components/ui'
import { books, currentBook } from '../../mocks'
import { ContinueReadingCard } from './ContinueReadingCard'
import { BrandMark, HomeNavigation, Sidebar } from './HomeNavigation'
import { MobileBottomNavigation, MobileHeader, MobileShortcuts } from './MobileHomeChrome'
import { QuickReviewCard } from './QuickReviewCard'
import { RecentlyRead } from './RecentlyRead'
import './home.css'

export function HomePage() {
  const recentlyRead = books.filter((book) => book.id !== currentBook.id)

  return (
    <div className="home-shell">
      <Sidebar currentBookId={currentBook.id} />

      <div className="home-workspace">
        <MobileHeader />

        <header className="home-tablet-header">
          <BrandMark />
          <HomeNavigation currentBookId={currentBook.id} placement="tablet" />
          <ThemeToggle />
        </header>

        <main className="home-main">
          <div className="home-intro">
            <p className="home-intro__greeting">Good evening</p>
            <h1>Pick up where you left off.</h1>
            <p>A quiet chapter is waiting, whenever you are ready.</p>
          </div>

          <div className="home-dashboard">
            <div className="home-dashboard__continue">
              <ContinueReadingCard book={currentBook} />
            </div>
            <MobileShortcuts />
            <div className="home-dashboard__recent">
              <RecentlyRead books={recentlyRead} />
            </div>
            <div className="home-dashboard__review">
              <QuickReviewCard />
            </div>
          </div>
        </main>

        <MobileBottomNavigation currentBookId={currentBook.id} />
      </div>
    </div>
  )
}
