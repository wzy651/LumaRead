import type { DocumentSection } from './documents/types'

export const annotationColors = ['lavender', 'amber', 'sage'] as const
export type AnnotationColor = (typeof annotationColors)[number]

export type TextAnchorSegment = {
  sectionId: string
  sectionIndex: number
  blockId: string
  startOffset: number
  endOffset: number
  exact: string
  prefix: string
  suffix: string
}

export type ReaderAnnotation = {
  id: string
  resourceKey: string
  anchorKey: string
  segments: TextAnchorSegment[]
  quote: string
  color: AnnotationColor
  note?: string
  createdAt: number
  updatedAt: number
  orphaned?: boolean
}

export type AnnotationInput = Omit<ReaderAnnotation, 'id' | 'anchorKey' | 'createdAt' | 'updatedAt'> & Partial<Pick<ReaderAnnotation, 'id' | 'anchorKey' | 'createdAt' | 'updatedAt'>>
export type AnnotationPatch = Partial<Pick<ReaderAnnotation, 'segments' | 'quote' | 'color' | 'note' | 'orphaned'>>

export const maxAnnotationQuoteLength = 20_000
export const maxAnnotationNoteLength = 4_000
export const annotationContextLength = 48

function validColor(value: unknown): value is AnnotationColor { return typeof value === 'string' && (annotationColors as readonly string[]).includes(value) }
function clampBoundary(value: number, text: string) {
  let next = Math.max(0, Math.min(text.length, Math.round(value)))
  if (next > 0 && next < text.length && text.charCodeAt(next - 1) >= 0xd800 && text.charCodeAt(next - 1) <= 0xdbff && text.charCodeAt(next) >= 0xdc00 && text.charCodeAt(next) <= 0xdfff) next -= 1
  return next
}

export function normalizeTextAnchorSegments(segments: TextAnchorSegment[]): TextAnchorSegment[] {
  return [...segments].map((segment, index) => ({ segment, index, normalized: {
    ...segment,
    sectionId: segment.sectionId,
    sectionIndex: Math.max(0, Math.round(segment.sectionIndex)),
    startOffset: Math.max(0, Math.round(segment.startOffset)),
    endOffset: Math.max(0, Math.round(segment.endOffset)),
    exact: segment.exact.slice(0, maxAnnotationQuoteLength),
    prefix: segment.prefix.slice(-annotationContextLength),
    suffix: segment.suffix.slice(0, annotationContextLength),
  } })).sort((left, right) => left.normalized.sectionIndex - right.normalized.sectionIndex || left.index - right.index || left.normalized.startOffset - right.normalized.startOffset).map(({ normalized }) => normalized)
}

export function annotationAnchorKey(segments: TextAnchorSegment[]): string {
  return JSON.stringify(normalizeTextAnchorSegments(segments).map(({ sectionId, sectionIndex, blockId, startOffset, endOffset, exact }) => ({ sectionId, sectionIndex, blockId, startOffset, endOffset, exact })))
}

export function annotationFromInput(input: AnnotationInput): ReaderAnnotation {
  const segments = normalizeTextAnchorSegments(input.segments)
  if (!input.resourceKey || !segments.length || !input.quote.trim()) throw new TypeError('A highlight needs a resource, text anchor, and quote.')
  const now = Date.now()
  return {
    id: input.id ?? `annotation-${now}-${Math.random().toString(36).slice(2, 10)}`,
    resourceKey: input.resourceKey,
    anchorKey: input.anchorKey ?? annotationAnchorKey(segments),
    segments,
    quote: input.quote.slice(0, maxAnnotationQuoteLength),
    color: validColor(input.color) ? input.color : 'lavender',
    ...(input.note?.slice(0, maxAnnotationNoteLength) ? { note: input.note.slice(0, maxAnnotationNoteLength) } : {}),
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
    ...(input.orphaned ? { orphaned: true } : {}),
  }
}

export function isValidAnnotation(value: unknown): value is ReaderAnnotation {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<ReaderAnnotation>
  return typeof candidate.id === 'string' && typeof candidate.resourceKey === 'string' && typeof candidate.anchorKey === 'string' && Array.isArray(candidate.segments) && candidate.segments.length > 0 && typeof candidate.quote === 'string' && validColor(candidate.color) && typeof candidate.createdAt === 'number' && typeof candidate.updatedAt === 'number'
}

export function annotationSegmentsOverlap(left: TextAnchorSegment, right: TextAnchorSegment) {
  if (left.sectionId !== right.sectionId || left.blockId !== right.blockId) return false
  return left.startOffset < right.endOffset && right.startOffset < left.endOffset
}

export function annotationsOverlap(left: TextAnchorSegment[], right: TextAnchorSegment[]) {
  return left.some((a) => right.some((b) => annotationSegmentsOverlap(a, b)))
}

export function findAnnotationOverlap(annotations: ReaderAnnotation[], segments: TextAnchorSegment[]) {
  return annotations.find((annotation) => annotationsOverlap(annotation.segments, segments))
}

export function annotationSegmentsForSection(annotation: ReaderAnnotation, sectionId: string) {
  return annotation.segments.filter((segment) => segment.sectionId === sectionId)
}

export function clampAnnotationSegment(segment: TextAnchorSegment, text: string): TextAnchorSegment | undefined {
  const startOffset = clampBoundary(segment.startOffset, text)
  const endOffset = clampBoundary(segment.endOffset, text)
  if (startOffset >= endOffset || !text.slice(startOffset, endOffset)) return undefined
  return { ...segment, startOffset, endOffset, exact: text.slice(startOffset, endOffset), prefix: text.slice(Math.max(0, startOffset - annotationContextLength), startOffset), suffix: text.slice(endOffset, endOffset + annotationContextLength) }
}

export function annotationLocationLabel(annotation: ReaderAnnotation, sections: DocumentSection[]) {
  const first = annotation.segments[0]
  if (!first || annotation.orphaned) return 'Location unavailable'
  return sections[first.sectionIndex]?.title ?? `Section ${first.sectionIndex + 1}`
}
