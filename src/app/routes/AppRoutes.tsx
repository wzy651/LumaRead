import { Navigate, Route, Routes } from 'react-router-dom'
import { HomePage } from '../../features/home'
import { ReaderPage } from '../../features/reader'
import { QuickReviewPage } from '../../features/review'
import { SessionSummaryPage } from '../../features/session-summary'
import { RouteEffects } from './RouteEffects'

export function AppRoutes() {
  return (
    <>
      <RouteEffects />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/reader/:bookId" element={<ReaderPage />} />
        <Route path="/review" element={<QuickReviewPage />} />
        <Route path="/session-summary" element={<SessionSummaryPage />} />
        <Route path="*" element={<Navigate replace to="/" />} />
      </Routes>
    </>
  )
}
