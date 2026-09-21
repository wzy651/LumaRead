import type { ReaderLocator } from './reader-locator'

export interface Bookmark {
  id: string
  resourceKey: string
  anchorKey: string
  locator: ReaderLocator
  label?: string
  excerpt?: string
  createdAt: number
  updatedAt: number
}

export type BookmarkInput = Omit<Bookmark, 'id' | 'anchorKey' | 'createdAt' | 'updatedAt'> & Partial<Pick<Bookmark, 'id' | 'anchorKey' | 'createdAt' | 'updatedAt'>>
