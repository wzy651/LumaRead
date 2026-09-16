import type { ImportedDocument } from '../../domain/documents'
import type { ReadingActivity } from '../../domain/reading-activity'
import { currentBook } from '../../mocks'
import type { DocumentRepository } from '../../domain/documents'
import type { ReadingActivityRepository } from '../../storage'

export interface HomeReadingItem { id: string; route: string; title: string; author?: string; format: string; contentKind: ReadingActivity['contentKind']; locationLabel?: string; progressPercent?: number; coverUrl?: string; lastOpenedAt: string }
export interface HomeReadingViewModel { continueReading?: HomeReadingItem; recentlyRead: HomeReadingItem[] }
function item(activity: ReadingActivity, document?: ImportedDocument): HomeReadingItem | undefined {
  if (activity.contentKind === 'builtin') return activity.documentId === currentBook.id ? { id: activity.documentId, route: `/reader/${activity.documentId}`, title: currentBook.title, author: currentBook.author, format: 'BOOK', contentKind: 'builtin', locationLabel: activity.locationLabel, progressPercent: activity.progressPercent, coverUrl: currentBook.coverUrl, lastOpenedAt: activity.lastOpenedAt } : undefined
  if (!document) return undefined
  return { id: document.id, route: `/reader/${document.id}`, title: document.metadata.title, author: document.metadata.author, format: document.format.toUpperCase(), contentKind: 'imported', locationLabel: activity.locationLabel, progressPercent: activity.progressPercent, coverUrl: document.metadata.cover, lastOpenedAt: activity.lastOpenedAt }
}
export class HomeReadingService {
  constructor(private readonly documents: Pick<DocumentRepository, 'listDocuments'>, private readonly activities: ReadingActivityRepository) {}
  async getViewModel(): Promise<HomeReadingViewModel> { const [activities, documents] = await Promise.all([this.activities.listActivities(), this.documents.listDocuments()]); const byId = new Map(documents.map((document) => [document.id, document])); const valid: Array<{ activity: ReadingActivity; value: HomeReadingItem }> = []; const stale: string[] = []; for (const activity of activities) { const value = item(activity, byId.get(activity.documentId)); if (value) valid.push({ activity, value }); else stale.push(activity.key) }; await Promise.all(stale.map((key) => this.activities.deleteActivity(key).catch(() => undefined))); valid.sort((a, b) => b.activity.lastOpenedAt.localeCompare(a.activity.lastOpenedAt)); const continueReading = valid[0]?.value; const currentKey = valid[0]?.activity.key; const recent = valid.filter(({ activity }) => activity.key !== currentKey && Boolean(activity.lastReadAt)).sort((a, b) => (b.activity.lastReadAt ?? b.activity.lastOpenedAt).localeCompare(a.activity.lastReadAt ?? a.activity.lastOpenedAt) || b.activity.lastOpenedAt.localeCompare(a.activity.lastOpenedAt)).map(({ value }) => value).slice(0, 4); return { continueReading, recentlyRead: recent } }
}
