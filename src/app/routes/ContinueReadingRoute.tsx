import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { HomeReadingService } from '../../features/home/home-reading-service'
import { getDocumentRepository, getReadingActivityRepository } from '../../storage'
export function ContinueReadingRoute() { const [route, setRoute] = useState<string>(); useEffect(() => { void new HomeReadingService(getDocumentRepository(), getReadingActivityRepository()).getViewModel().then((model) => setRoute(model.continueReading?.route ?? '/library')).catch(() => setRoute('/library')) }, []); if (!route) return <main aria-live="polite">Loading your reading…</main>; return <Navigate replace to={route} /> }
