import { Navigate, Route, Routes } from 'react-router-dom'
import { HomePlaceholder } from '../../features/home'
import { ReaderPlaceholder } from '../../features/reader'
import { ReviewPlaceholder } from '../../features/review'
import { SessionSummaryPlaceholder } from '../../features/session-summary'

export function AppRoutes() {
  return <Routes><Route path="/" element={<HomePlaceholder />} /><Route path="/reader/:bookId" element={<ReaderPlaceholder />} /><Route path="/review" element={<ReviewPlaceholder />} /><Route path="/session-summary" element={<SessionSummaryPlaceholder />} /><Route path="*" element={<Navigate replace to="/" />} /></Routes>
}
