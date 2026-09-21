import { readerLocatorAnchorKey, normalizeReaderLocator, type Bookmark, type BookmarkInput, type ReaderLocator } from '../domain'
import { openDatabase, requestResult, storageError, transactionComplete } from './database'

export interface BookmarkRepository {
  listForResource(resourceKey: string): Promise<Bookmark[]>
  findByAnchor(resourceKey: string, anchorKey: string): Promise<Bookmark | undefined>
  add(input: BookmarkInput): Promise<Bookmark>
  remove(id: string): Promise<void>
  toggleAtLocator(input: BookmarkInput): Promise<Bookmark | undefined>
  toggleAtLocator(resourceKey: string, locator: ReaderLocator, details?: Omit<Partial<BookmarkInput>, 'resourceKey' | 'locator'>): Promise<Bookmark | undefined>
  deleteForResource(resourceKey: string): Promise<void>
}

export function bookmarkFromInput(input: BookmarkInput): Bookmark {
  const locator = normalizeReaderLocator(input.locator)
  if (!locator) throw storageError('This bookmark location is no longer valid.')
  if (input.resourceKey !== locator.resourceKey) throw storageError('This bookmark belongs to a different document.')
  const now = Date.now()
  return {
    id: input.id ?? `bookmark-${now}-${Math.random().toString(36).slice(2, 10)}`,
    resourceKey: input.resourceKey,
    anchorKey: readerLocatorAnchorKey(locator),
    locator,
    ...(input.label ? { label: input.label } : {}),
    ...(input.excerpt ? { excerpt: input.excerpt } : {}),
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
  }
}

function sortBookmarks(bookmarks: Bookmark[]) {
  return [...bookmarks].sort((left, right) => left.createdAt - right.createdAt || left.id.localeCompare(right.id))
}

function normalizeStoredBookmark(value: unknown): Bookmark | undefined {
  if (!value || typeof value !== 'object') return undefined
  const bookmark = value as Bookmark
  const locator = normalizeReaderLocator(bookmark.locator)
  if (!locator || bookmark.resourceKey !== locator.resourceKey || typeof bookmark.id !== 'string') return undefined
  return { ...bookmark, locator, anchorKey: readerLocatorAnchorKey(locator) }
}

function normalizeStoredBookmarks(values: unknown[]) {
  return values.flatMap((value) => { const bookmark = normalizeStoredBookmark(value); return bookmark ? [bookmark] : [] })
}

function toggleInput(inputOrResource: BookmarkInput | string, locator?: ReaderLocator, details?: Omit<Partial<BookmarkInput>, 'resourceKey' | 'locator'>): BookmarkInput {
  return typeof inputOrResource === 'string' ? { resourceKey: inputOrResource, locator: locator!, ...details } as BookmarkInput : inputOrResource
}

export class MemoryBookmarkRepository implements BookmarkRepository {
  private readonly bookmarks = new Map<string, Bookmark>()
  private readonly anchors = new Map<string, string>()

  async listForResource(resourceKey: string) { return sortBookmarks(normalizeStoredBookmarks([...this.bookmarks.values()]).filter((bookmark) => bookmark.resourceKey === resourceKey)) }
  async findByAnchor(resourceKey: string, anchorKey: string) { const id = this.anchors.get(`${resourceKey}\u0000${anchorKey}`); const bookmark = id ? normalizeStoredBookmark(this.bookmarks.get(id)) : undefined; return bookmark?.resourceKey === resourceKey ? bookmark : undefined }
  async add(input: BookmarkInput) {
    const bookmark = bookmarkFromInput(input)
    const existing = await this.findByAnchor(bookmark.resourceKey, bookmark.anchorKey)
    if (existing) return existing
    this.bookmarks.set(bookmark.id, bookmark)
    this.anchors.set(`${bookmark.resourceKey}\u0000${bookmark.anchorKey}`, bookmark.id)
    return bookmark
  }
  async remove(id: string) { const bookmark = this.bookmarks.get(id); if (bookmark) { this.bookmarks.delete(id); this.anchors.delete(`${bookmark.resourceKey}\u0000${bookmark.anchorKey}`) } }
  async toggleAtLocator(inputOrResource: BookmarkInput | string, locator?: ReaderLocator, details?: Omit<Partial<BookmarkInput>, 'resourceKey' | 'locator'>) {
    const input = toggleInput(inputOrResource, locator, details)
    const normalized = normalizeReaderLocator(input.locator)
    if (!normalized) throw storageError('This bookmark location is no longer valid.')
    const anchorKey = readerLocatorAnchorKey(normalized)
    const existing = await this.findByAnchor(input.resourceKey, anchorKey)
    if (existing) { await this.remove(existing.id); return undefined }
    return this.add({ ...input, locator: normalized, anchorKey })
  }
  async deleteForResource(resourceKey: string) { for (const bookmark of [...this.bookmarks.values()]) if (bookmark.resourceKey === resourceKey) await this.remove(bookmark.id) }
}

export class IndexedDbBookmarkRepository implements BookmarkRepository {
  async listForResource(resourceKey: string) {
    const db = await openDatabase()
    try { return sortBookmarks(normalizeStoredBookmarks(await requestResult(db.transaction('bookmarks').objectStore('bookmarks').index('resourceKey').getAll(resourceKey)) as unknown[])) } finally { db.close() }
  }
  async findByAnchor(resourceKey: string, anchorKey: string) {
    const db = await openDatabase()
    try {
      const record = normalizeStoredBookmark(await requestResult(db.transaction('bookmarks').objectStore('bookmarks').index('anchorKey').get(anchorKey)))
      return record?.resourceKey === resourceKey ? record : undefined
    } finally { db.close() }
  }
  async add(input: BookmarkInput) {
    const bookmark = bookmarkFromInput(input)
    const existing = await this.findByAnchor(bookmark.resourceKey, bookmark.anchorKey)
    if (existing) return existing
    const db = await openDatabase()
    try {
      const transaction = db.transaction('bookmarks', 'readwrite')
      const completion = transactionComplete(transaction)
      try {
        await Promise.all([requestResult(transaction.objectStore('bookmarks').add(bookmark)), completion])
      } catch (error) {
        const name = error instanceof Error ? error.name : ''
        const code = typeof error === 'object' && error !== null && 'code' in error ? (error as { code?: unknown }).code : undefined
        if (name === 'ConstraintError' || code === 'duplicate-document') {
          const duplicate = await this.findByAnchor(bookmark.resourceKey, bookmark.anchorKey)
          if (duplicate) return duplicate
        }
        throw storageError('LumaRead could not save this bookmark.')
      }
      return bookmark
    } finally { db.close() }
  }
  async remove(id: string) {
    const db = await openDatabase()
    try { const transaction = db.transaction('bookmarks', 'readwrite'); const completion = transactionComplete(transaction); await Promise.all([requestResult(transaction.objectStore('bookmarks').delete(id)), completion]) } finally { db.close() }
  }
  async toggleAtLocator(inputOrResource: BookmarkInput | string, locator?: ReaderLocator, details?: Omit<Partial<BookmarkInput>, 'resourceKey' | 'locator'>) {
    const input = toggleInput(inputOrResource, locator, details)
    const normalized = normalizeReaderLocator(input.locator)
    if (!normalized) throw storageError('This bookmark location is no longer valid.')
    const anchorKey = readerLocatorAnchorKey(normalized)
    const existing = await this.findByAnchor(input.resourceKey, anchorKey)
    if (existing) { await this.remove(existing.id); return undefined }
    return this.add({ ...input, locator: normalized, anchorKey })
  }
  async deleteForResource(resourceKey: string) {
    const bookmarks = await this.listForResource(resourceKey)
    const db = await openDatabase()
    try {
      const transaction = db.transaction('bookmarks', 'readwrite')
      const completion = transactionComplete(transaction)
      const store = transaction.objectStore('bookmarks')
      await Promise.all([Promise.all(bookmarks.map((bookmark) => requestResult(store.delete(bookmark.id)))), completion])
    } finally { db.close() }
  }
}

let repository: BookmarkRepository | undefined
export function getBookmarkRepository() { repository ??= new IndexedDbBookmarkRepository(); return repository }
export function resetBookmarkRepositoryForTests() { repository = undefined }
