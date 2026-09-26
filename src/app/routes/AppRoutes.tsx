import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { HomePage } from '../../features/home'
import { LibraryPage } from '../../features/library'
import { QuickReviewPage } from '../../features/review'
import { SessionSummaryPage } from '../../features/session-summary'
import { RouteEffects } from './RouteEffects'
import { ContinueReadingRoute } from './ContinueReadingRoute'

const ReaderPage = lazy(() => import('../../features/reader/ReaderPage').then(({ ReaderPage: page }) => ({ default: page })))
const LearningSettingsPage = lazy(() => import('../../features/learning/LearningSettingsPage').then(({ LearningSettingsPage: page }) => ({ default: page })))

export function AppRoutes() {
  return (
    <>
      <RouteEffects />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/library" element={<LibraryPage />} />
        <Route path="/settings" element={<Suspense fallback={<div className="reader-message">Opening settings…</div>}><LearningSettingsPage /></Suspense>} />
        <Route path="/read" element={<ContinueReadingRoute />} />
        <Route path="/reader/:bookId" element={<Suspense fallback={<div aria-live="polite" className="reader-message">Opening your reader…</div>}><ReaderPage /></Suspense>} />
        <Route path="/review" element={<QuickReviewPage />} />
        <Route path="/session-summary" element={<SessionSummaryPage />} />
        <Route path="*" element={<Navigate replace to="/" />} />
      </Routes>
    </>
  )
}
