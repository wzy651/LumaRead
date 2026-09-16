import { Navigate, Route, Routes } from 'react-router-dom'
import { HomePage } from '../../features/home'
import { LibraryPage } from '../../features/library'
import { ReaderPage } from '../../features/reader'
import { QuickReviewPage } from '../../features/review'
import { SessionSummaryPage } from '../../features/session-summary'
import { RouteEffects } from './RouteEffects'
import { ContinueReadingRoute } from './ContinueReadingRoute'

export function AppRoutes() {
  return (
    <>
      <RouteEffects />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/library" element={<LibraryPage />} />
        <Route path="/read" element={<ContinueReadingRoute />} />
        <Route path="/reader/:bookId" element={<ReaderPage />} />
        <Route path="/review" element={<QuickReviewPage />} />
        <Route path="/session-summary" element={<SessionSummaryPage />} />
        <Route path="*" element={<Navigate replace to="/" />} />
      </Routes>
    </>
  )
}
