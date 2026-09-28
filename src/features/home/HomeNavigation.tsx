import { BarChart3, BookOpen, Home, Library, RotateCcw } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ThemeToggle } from '../../components/ui'

interface HomeNavigationProps { placement: 'sidebar' | 'tablet' }

interface AvailableNavigationItem {
  icon: LucideIcon
  label: string
  to: string
  active?: boolean
}

interface UpcomingNavigationItem {
  icon: LucideIcon
  label: string
  upcoming: true
}

type NavigationItem = AvailableNavigationItem | UpcomingNavigationItem

export function BrandMark() {
  return (
    <Link aria-label="LumaRead home" className="home-brand" to="/">
      <span aria-hidden="true" className="home-brand__mark">L</span>
      <span>LumaRead</span>
    </Link>
  )
}

function BuildInfo() {
  const label = import.meta.env.DEV ? `Development build · ${__LUMAREAD_BUILD__.commit}` : `Version ${__LUMAREAD_BUILD__.version}`
  return <small aria-label={label} className="home-build-info" data-testid="build-info">{label}</small>
}

export function HomeNavigation({ placement }: HomeNavigationProps) {
  const items: NavigationItem[] = [
    { icon: Home, label: 'Home', to: '/', active: true },
    { icon: BookOpen, label: 'Reading', to: '/read' },
    { icon: RotateCcw, label: 'Quick review', to: '/review' },
    { icon: Library, label: 'Library', to: '/library' },
    { icon: BarChart3, label: 'Stats', to: '/statistics' },
  ]

  return (
    <nav aria-label={placement === 'sidebar' ? 'Primary navigation' : 'Tablet navigation'} className={`home-nav home-nav--${placement}`}>
      <ul>
        {items.map((item) => {
          const Icon = item.icon

          if ('upcoming' in item) {
            return (
              <li key={item.label}>
                <button className="home-nav__item home-nav__item--upcoming" disabled title={`${item.label} — Coming soon`} type="button">
                  <Icon aria-hidden="true" size={19} strokeWidth={1.8} />
                  <span>{item.label}</span>
                  <span className="home-nav__soon">Soon</span>
                </button>
              </li>
            )
          }

          return (
            <li key={item.label}>
              <Link aria-current={item.active ? 'page' : undefined} className="home-nav__item" to={item.to}>
                <Icon aria-hidden="true" size={19} strokeWidth={1.8} />
                <span>{item.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

export function Sidebar() {
  return (
    <aside className="home-sidebar">
      <BrandMark />
      <HomeNavigation placement="sidebar" />
      <div className="home-sidebar__footer">
        <ThemeToggle />
        <div className="home-sidebar__appearance">
          <span>Appearance</span>
          <small>Light or dark</small>
        </div>
        <BuildInfo />
      </div>
    </aside>
  )
}
