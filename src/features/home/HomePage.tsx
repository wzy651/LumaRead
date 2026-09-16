import { ThemeToggle } from '../../components/ui'
import { useCallback, useEffect, useRef, useState } from 'react'
import { getDocumentRepository, getReadingActivityRepository } from '../../storage'
import { HomeReadingService, type HomeReadingViewModel } from './home-reading-service'
import { ContinueReadingCard } from './ContinueReadingCard'
import { BrandMark, HomeNavigation, Sidebar } from './HomeNavigation'
import { MobileBottomNavigation, MobileHeader, MobileShortcuts } from './MobileHomeChrome'
import { QuickReviewCard } from './QuickReviewCard'
import { RecentlyRead } from './RecentlyRead'
import './home.css'

export function HomePage() {
  const [reading, setReading] = useState<HomeReadingViewModel>({ recentlyRead: [] })
  const latestRequest = useRef(0)
  const mounted = useRef(true)
  const refresh = useCallback(() => { const request = ++latestRequest.current; void new HomeReadingService(getDocumentRepository(), getReadingActivityRepository()).getViewModel().then((next) => { if (mounted.current && request === latestRequest.current) setReading(next) }).catch(() => undefined) }, [])
  useEffect(() => { mounted.current = true; refresh(); window.addEventListener('readingactivitychanged', refresh); window.addEventListener('focus', refresh); return () => { mounted.current = false; window.removeEventListener('readingactivitychanged', refresh); window.removeEventListener('focus', refresh) } }, [refresh])

  return (
    <div className="home-shell">
      <Sidebar />

      <div className="home-workspace">
        <MobileHeader />

        <header className="home-tablet-header">
          <BrandMark />
          <HomeNavigation placement="tablet" />
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
              <ContinueReadingCard item={reading.continueReading} />
            </div>
            <MobileShortcuts />
            <div className="home-dashboard__recent">
              <RecentlyRead books={reading.recentlyRead} />
            </div>
            <div className="home-dashboard__review">
              <QuickReviewCard />
            </div>
          </div>
        </main>

        <MobileBottomNavigation />
      </div>
    </div>
  )
}
