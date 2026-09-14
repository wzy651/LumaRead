import { BarChart3, BookOpen, Home, Library, RotateCcw, Search } from 'lucide-react'
import { Link } from 'react-router-dom'
import { IconButton, ThemeToggle } from '../../components/ui'
import { BrandMark } from './HomeNavigation'

export function MobileHeader() {
  return (
    <header className="home-mobile-header">
      <BrandMark />
      <IconButton disabled label="Search — coming soon" title="Search — Coming soon">
        <Search aria-hidden="true" size={20} strokeWidth={1.8} />
      </IconButton>
    </header>
  )
}

export function MobileShortcuts() {
  return (
    <section aria-label="Shortcuts" className="home-shortcuts">
      <Link className="home-shortcut" to="/review">
        <span className="home-shortcut__icon"><RotateCcw aria-hidden="true" size={20} strokeWidth={1.8} /></span>
        <span>Review</span>
      </Link>
      <button className="home-shortcut home-shortcut--upcoming" disabled title="Stats — Coming soon" type="button">
        <span className="home-shortcut__icon"><BarChart3 aria-hidden="true" size={20} strokeWidth={1.8} /></span>
        <span>Stats</span>
        <small>Soon</small>
      </button>
      <button className="home-shortcut home-shortcut--upcoming" disabled title="Library — Coming soon" type="button">
        <span className="home-shortcut__icon"><Library aria-hidden="true" size={20} strokeWidth={1.8} /></span>
        <span>Library</span>
        <small>Soon</small>
      </button>
    </section>
  )
}

export function MobileBottomNavigation({ currentBookId }: { currentBookId: string }) {
  return (
    <nav aria-label="Mobile primary navigation" className="home-mobile-nav">
      <Link aria-current="page" className="home-mobile-nav__item" to="/">
        <Home aria-hidden="true" size={20} strokeWidth={1.9} />
        <span>Home</span>
      </Link>
      <Link className="home-mobile-nav__item" to={`/reader/${currentBookId}`}>
        <BookOpen aria-hidden="true" size={20} strokeWidth={1.9} />
        <span>Read</span>
      </Link>
      <Link className="home-mobile-nav__item" to="/review">
        <RotateCcw aria-hidden="true" size={20} strokeWidth={1.9} />
        <span>Review</span>
      </Link>
      <div className="home-mobile-nav__theme">
        <ThemeToggle />
        <span aria-hidden="true">Theme</span>
      </div>
    </nav>
  )
}
