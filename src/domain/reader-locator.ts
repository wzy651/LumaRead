import type { DocumentSection } from './documents/types'

export type ReflowableReaderLocator = {
  version: 1
  kind: 'reflowable'
  resourceKey: string
  sectionId: string
  sectionIndex: number
  progression?: number
  blockId?: string
  textOffset?: number
}

export type PdfReaderLocator = {
  version: 1
  kind: 'pdf'
  resourceKey: string
  pageNumber: number
}

export type ReaderLocator = ReflowableReaderLocator | PdfReaderLocator

export type LocatorSection = Pick<DocumentSection, 'id' | 'blocks'>

const resourceKeyPattern = /^(builtin|imported):[^:]+$/

function finiteInteger(value: unknown, minimum = 0): value is number {
  return typeof value === 'number' && Number.isInteger(value) && Number.isFinite(value) && value >= minimum
}

function finiteProgression(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
}

function validResourceKey(value: unknown): value is string {
  return typeof value === 'string' && resourceKeyPattern.test(value)
}

export function isReflowableReaderLocator(value: unknown): value is ReflowableReaderLocator {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<ReflowableReaderLocator>
  return candidate.version === 1 && candidate.kind === 'reflowable' && validResourceKey(candidate.resourceKey) && typeof candidate.sectionId === 'string' && Boolean(candidate.sectionId) && finiteInteger(candidate.sectionIndex) && (candidate.progression === undefined || finiteProgression(candidate.progression)) && (candidate.blockId === undefined || (typeof candidate.blockId === 'string' && Boolean(candidate.blockId))) && (candidate.textOffset === undefined || finiteInteger(candidate.textOffset))
}

export function isPdfReaderLocator(value: unknown): value is PdfReaderLocator {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<PdfReaderLocator>
  return candidate.version === 1 && candidate.kind === 'pdf' && validResourceKey(candidate.resourceKey) && finiteInteger(candidate.pageNumber, 1)
}

export function isReaderLocator(value: unknown): value is ReaderLocator {
  return isReflowableReaderLocator(value) || isPdfReaderLocator(value)
}

/** Returns a canonical locator, or undefined for untrusted/expired input. */
export function normalizeReaderLocator(value: unknown): ReaderLocator | undefined {
  if (!value || typeof value !== 'object') return undefined
  const candidate = value as Record<string, unknown>
  if (candidate.kind === 'pdf') {
    if (candidate.version !== 1 || !validResourceKey(candidate.resourceKey) || typeof candidate.pageNumber !== 'number' || !Number.isFinite(candidate.pageNumber)) return undefined
    return { version: 1, kind: 'pdf', resourceKey: candidate.resourceKey, pageNumber: Math.max(1, Math.round(candidate.pageNumber)) }
  }
  if (candidate.version !== 1 || candidate.kind !== 'reflowable' || !validResourceKey(candidate.resourceKey) || typeof candidate.sectionId !== 'string' || !candidate.sectionId.trim() || typeof candidate.sectionIndex !== 'number' || !Number.isFinite(candidate.sectionIndex)) return undefined
  const locator: ReflowableReaderLocator = { version: 1, kind: 'reflowable', resourceKey: candidate.resourceKey, sectionId: candidate.sectionId.trim(), sectionIndex: Math.max(0, Math.round(candidate.sectionIndex)) }
  if (candidate.progression !== undefined) { if (typeof candidate.progression !== 'number' || !Number.isFinite(candidate.progression)) return undefined; locator.progression = Math.min(1, Math.max(0, candidate.progression)) }
  if (candidate.blockId !== undefined) { if (typeof candidate.blockId !== 'string' || !candidate.blockId.trim()) return undefined; locator.blockId = candidate.blockId.trim() }
  if (candidate.textOffset !== undefined) { if (typeof candidate.textOffset !== 'number' || !Number.isFinite(candidate.textOffset)) return undefined; locator.textOffset = Math.max(0, Math.round(candidate.textOffset)) }
  return locator
}

export function serializeReaderLocator(locator: ReaderLocator): string {
  const normalized = normalizeReaderLocator(locator)
  if (!normalized) throw new TypeError('Cannot serialize an invalid ReaderLocator.')
  return JSON.stringify(normalized)
}

export function deserializeReaderLocator(serialized: unknown): ReaderLocator | undefined {
  if (typeof serialized !== 'string') return normalizeReaderLocator(serialized)
  try {
    return normalizeReaderLocator(JSON.parse(serialized) as unknown)
  } catch {
    return undefined
  }
}

export function readerLocatorAnchorKey(locator: ReaderLocator): string {
  return serializeReaderLocator(locator)
}

export const createAnchorKey = readerLocatorAnchorKey
export const validateReaderLocator = isReaderLocator
export const normalizeLocator = normalizeReaderLocator
export const serializeLocator = serializeReaderLocator
export const deserializeLocator = deserializeReaderLocator
export const anchorKeyForLocator = readerLocatorAnchorKey

export interface LocatorResolution {
  locator: ReaderLocator
  sectionIndex?: number
  blockId?: string
  pageNumber?: number
  usedFallback: boolean
}

/** Resolves stale section/block ids without ever returning an unusable position. */
export function resolveReaderLocator(locator: unknown, options: { resourceKey: string; sections?: LocatorSection[]; pageCount?: number }): LocatorResolution {
  const normalized = normalizeReaderLocator(locator)
  if (normalized?.resourceKey !== options.resourceKey) {
    return options.pageCount !== undefined
      ? { locator: { version: 1, kind: 'pdf', resourceKey: options.resourceKey, pageNumber: 1 }, pageNumber: 1, usedFallback: true }
      : { locator: { version: 1, kind: 'reflowable', resourceKey: options.resourceKey, sectionId: options.sections?.[0]?.id ?? 'section-0', sectionIndex: 0, progression: 0 }, sectionIndex: 0, usedFallback: true }
  }
  if (normalized?.kind === 'pdf') {
    const pageNumber = options.pageCount && normalized.pageNumber <= options.pageCount ? normalized.pageNumber : 1
    return { locator: { ...normalized, pageNumber }, pageNumber, usedFallback: pageNumber !== normalized.pageNumber }
  }
  const sections = options.sections ?? []
  const sectionById = normalized?.kind === 'reflowable' ? sections.findIndex((section) => section.id === normalized.sectionId) : -1
  const sectionIndex = sectionById >= 0 ? sectionById : Math.min(Math.max(normalized?.kind === 'reflowable' ? normalized.sectionIndex : 0, 0), Math.max(0, sections.length - 1))
  const section = sections[sectionIndex]
  const blockId = normalized?.kind === 'reflowable' && section?.blocks.some((block) => block.id === normalized.blockId) ? normalized.blockId : undefined
  const base: ReflowableReaderLocator = normalized?.kind === 'reflowable'
    ? { ...normalized, sectionId: section?.id ?? normalized.sectionId, sectionIndex, ...(blockId ? { blockId } : {}) }
    : { version: 1, kind: 'reflowable', resourceKey: options.resourceKey, sectionId: section?.id ?? 'section-0', sectionIndex, progression: 0 }
  return { locator: base, sectionIndex, ...(blockId ? { blockId } : {}), usedFallback: normalized?.kind !== 'reflowable' || sectionById < 0 || normalized.blockId !== blockId }
}

export function safeReaderLocator(value: unknown, resourceKey: string, sections?: LocatorSection[], pageCount?: number): ReaderLocator {
  return resolveReaderLocator(value, { resourceKey, sections, pageCount }).locator
}

export const fallbackReaderLocator = safeReaderLocator
