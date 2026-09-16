import { DocumentError, type DocumentRepository, type ReaderLocation, type StoredDocument } from '../domain/documents'
import { databaseName, databaseVersion, openDatabase, requestResult, transactionComplete, upgradeLegacyRecord } from './database'
type LegacyRecord = Parameters<typeof upgradeLegacyRecord>[0]

export class MemoryDocumentRepository implements DocumentRepository {
  private readonly documents = new Map<string, StoredDocument>(); private readonly locations = new Map<string, ReaderLocation>()
  async saveDocument(record: StoredDocument) { if (await this.hasDocument(record.document.fingerprint)) throw new DocumentError('duplicate-document', 'This document is already in your library.'); this.documents.set(record.document.id, record) }
  async getDocument(id: string) { return this.documents.get(id) }
  async listDocuments() { return [...this.documents.values()].map(({ document }) => document).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) }
  async hasDocument(fingerprint: string) { return [...this.documents.values()].some(({ document }) => document.fingerprint === fingerprint) }
  async saveLocation(location: ReaderLocation) { this.locations.set(location.documentId, location) }
  async getLocation(documentId: string) { return this.locations.get(documentId) }
  async listLocations() { return [...this.locations.values()] }
}
export class IndexedDbDocumentRepository implements DocumentRepository {
  async saveDocument(record: StoredDocument) { const db = await openDatabase(); try { const transaction = db.transaction('documents', 'readwrite'); const completion = transactionComplete(transaction); await Promise.all([requestResult(transaction.objectStore('documents').put(record)), completion]) } finally { db.close() } }
  async getDocument(id: string) { const db = await openDatabase(); try { const transaction = db.transaction('documents'); const record = await requestResult(transaction.objectStore('documents').get(id)) as LegacyRecord | undefined; return record ? upgradeLegacyRecord(record) : undefined } finally { db.close() } }
  async listDocuments() { const db = await openDatabase(); try { const transaction = db.transaction('documents'); const records = await requestResult(transaction.objectStore('documents').getAll()) as LegacyRecord[]; return records.map(upgradeLegacyRecord).map(({ document }) => document).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) } finally { db.close() } }
  async hasDocument(fingerprint: string) { const db = await openDatabase(); try { const transaction = db.transaction('documents'); return Boolean(await requestResult(transaction.objectStore('documents').index('fingerprint').getKey(fingerprint))) } finally { db.close() } }
  async saveLocation(location: ReaderLocation) { const db = await openDatabase(); try { const transaction = db.transaction('locations', 'readwrite'); const completion = transactionComplete(transaction); await Promise.all([requestResult(transaction.objectStore('locations').put(location)), completion]) } finally { db.close() } }
  async getLocation(documentId: string) { const db = await openDatabase(); try { const transaction = db.transaction('locations'); return await requestResult(transaction.objectStore('locations').get(documentId)) } finally { db.close() } }
  async listLocations() { const db = await openDatabase(); try { const transaction = db.transaction('locations'); return await requestResult(transaction.objectStore('locations').getAll()) } finally { db.close() } }
}
let repository: DocumentRepository | undefined
export function getDocumentRepository() { repository ??= new IndexedDbDocumentRepository(); return repository }
export { databaseName, databaseVersion }
