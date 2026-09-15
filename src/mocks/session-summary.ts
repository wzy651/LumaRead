import type { SessionSummary } from '../domain'
import { lookupEvents } from './lookup-events'

export const sessionSummary: SessionSummary = { durationMinutes: 38, wordsRead: 5420, lookupCount: lookupEvents.length, expressionsToReview: 4 }
