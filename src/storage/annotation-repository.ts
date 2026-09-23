import { annotationAnchorKey, annotationFromInput, isValidAnnotation, type AnnotationInput, type AnnotationPatch, type ReaderAnnotation } from '../domain/annotation'
import { DocumentError } from '../domain/documents'
import { openDatabase, requestResult, storageError, transactionComplete } from './database'

export interface AnnotationRepository {
  listForResource(resourceKey: string): Promise<ReaderAnnotation[]>
  get(annotationId: string): Promise<ReaderAnnotation | undefined>
  findByAnchor(resourceKey: string, anchorKey: string): Promise<ReaderAnnotation | undefined>
  add(input: AnnotationInput): Promise<ReaderAnnotation>
  update(annotationId: string, patch: AnnotationPatch): Promise<ReaderAnnotation | undefined>
  remove(annotationId: string): Promise<void>
  deleteForResource(resourceKey: string): Promise<void>
}

function sortAnnotations(values: ReaderAnnotation[]) { return [...values].sort((left, right) => left.segments[0]?.sectionIndex - right.segments[0]?.sectionIndex || left.segments[0]?.startOffset - right.segments[0]?.startOffset || left.createdAt - right.createdAt || left.id.localeCompare(right.id)) }
function normalizeStored(value: unknown) { return isValidAnnotation(value) ? annotationFromInput(value) : undefined }
function duplicateError() { return new DocumentError('storage-failed', 'This text is already highlighted.') }

export class MemoryAnnotationRepository implements AnnotationRepository {
  private readonly annotations = new Map<string, ReaderAnnotation>()
  private readonly anchors = new Map<string, string>()
  async listForResource(resourceKey: string) { return sortAnnotations([...this.annotations.values()].filter((annotation) => annotation.resourceKey === resourceKey).flatMap((value) => { const annotation = normalizeStored(value); return annotation ? [annotation] : [] })) }
  async get(annotationId: string) { return normalizeStored(this.annotations.get(annotationId)) }
  async findByAnchor(resourceKey: string, anchorKey: string) { const id = this.anchors.get(`${resourceKey}\u0000${anchorKey}`); return id ? this.get(id) : undefined }
  async add(input: AnnotationInput) { const annotation = annotationFromInput(input); const existing = await this.findByAnchor(annotation.resourceKey, annotation.anchorKey); if (existing) return existing; this.annotations.set(annotation.id, annotation); this.anchors.set(`${annotation.resourceKey}\u0000${annotation.anchorKey}`, annotation.id); return annotation }
  async update(annotationId: string, patch: AnnotationPatch) { const current = await this.get(annotationId); if (!current) return undefined; const next = annotationFromInput({ ...current, ...patch, id: current.id, anchorKey: patch.segments ? annotationAnchorKey(patch.segments) : current.anchorKey, updatedAt: Date.now() }); if (next.anchorKey !== current.anchorKey) { const duplicate = await this.findByAnchor(next.resourceKey, next.anchorKey); if (duplicate && duplicate.id !== current.id) throw duplicateError(); this.anchors.delete(`${current.resourceKey}\u0000${current.anchorKey}`); this.anchors.set(`${next.resourceKey}\u0000${next.anchorKey}`, next.id) } this.annotations.set(annotationId, next); return next }
  async remove(annotationId: string) { const current = await this.get(annotationId); if (!current) return; this.annotations.delete(annotationId); this.anchors.delete(`${current.resourceKey}\u0000${current.anchorKey}`) }
  async deleteForResource(resourceKey: string) { for (const annotation of await this.listForResource(resourceKey)) await this.remove(annotation.id) }
}

function annotationError(error: unknown) { return error instanceof DocumentError ? error : storageError('LumaRead could not save this highlight.') }

export class IndexedDbAnnotationRepository implements AnnotationRepository {
  async listForResource(resourceKey: string) { const db = await openDatabase(); try { const values = await requestResult(db.transaction('annotations').objectStore('annotations').index('resourceKey').getAll(resourceKey)) as unknown[]; return sortAnnotations(values.flatMap((value) => { const annotation = normalizeStored(value); return annotation ? [annotation] : [] })) } finally { db.close() } }
  async get(annotationId: string) { const db = await openDatabase(); try { return normalizeStored(await requestResult(db.transaction('annotations').objectStore('annotations').get(annotationId))) } finally { db.close() } }
  async findByAnchor(resourceKey: string, anchorKey: string) { const db = await openDatabase(); try { const store = db.transaction('annotations').objectStore('annotations'); const value = await requestResult(store.index('resourceAnchor').get([resourceKey, anchorKey])); return normalizeStored(value) } finally { db.close() } }
  async add(input: AnnotationInput) { const annotation = annotationFromInput(input); const existing = await this.findByAnchor(annotation.resourceKey, annotation.anchorKey); if (existing) return existing; const db = await openDatabase(); try { const transaction = db.transaction('annotations', 'readwrite'); const completion = transactionComplete(transaction); try { await Promise.all([requestResult(transaction.objectStore('annotations').add(annotation)), completion]); return annotation } catch (error) { const duplicate = await this.findByAnchor(annotation.resourceKey, annotation.anchorKey); if (duplicate) return duplicate; throw annotationError(error) } } finally { db.close() } }
  async update(annotationId: string, patch: AnnotationPatch) { const current = await this.get(annotationId); if (!current) return undefined; const next = annotationFromInput({ ...current, ...patch, id: current.id, anchorKey: patch.segments ? annotationAnchorKey(patch.segments) : current.anchorKey, updatedAt: Date.now() }); const db = await openDatabase(); try { const transaction = db.transaction('annotations', 'readwrite'); const completion = transactionComplete(transaction); try { await Promise.all([requestResult(transaction.objectStore('annotations').put(next)), completion]); return next } catch (error) { throw annotationError(error) } } finally { db.close() } }
  async remove(annotationId: string) { const db = await openDatabase(); try { const transaction = db.transaction('annotations', 'readwrite'); const completion = transactionComplete(transaction); await Promise.all([requestResult(transaction.objectStore('annotations').delete(annotationId)), completion]) } finally { db.close() } }
  async deleteForResource(resourceKey: string) { const annotations = await this.listForResource(resourceKey); if (!annotations.length) return; const db = await openDatabase(); try { const transaction = db.transaction('annotations', 'readwrite'); const completion = transactionComplete(transaction); const store = transaction.objectStore('annotations'); await Promise.all([Promise.all(annotations.map((annotation) => requestResult(store.delete(annotation.id)))), completion]) } finally { db.close() } }
}

let repository: AnnotationRepository | undefined
export function getAnnotationRepository() { repository ??= new IndexedDbAnnotationRepository(); return repository }
export function resetAnnotationRepositoryForTests() { repository = undefined }
