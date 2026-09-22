import type { DocumentSection } from '../../domain/documents'
import type { ReaderLocator, ReflowableReaderLocator } from '../../domain/reader-locator'
import { normalizeReaderLocator, resolveReaderLocator } from '../../domain/reader-locator'

export interface LocatorNavigationContext {
  resourceKey: string
  sections: Pick<DocumentSection, 'id' | 'blocks'>[]
  sectionIndex: number
  root?: ParentNode
}

function sectionRoot(root: ParentNode, sectionId?: string): ParentNode {
  if (!sectionId) return root
  if (root instanceof HTMLElement && root.dataset.readerSectionId === sectionId) return root
  return Array.from(root.querySelectorAll<HTMLElement>('[data-reader-section-id]')).find((candidate) => candidate.dataset.readerSectionId === sectionId) ?? root
}

function blockElements(root: ParentNode = document, sectionId?: string) {
  return Array.from(sectionRoot(root, sectionId).querySelectorAll<HTMLElement>('[data-reader-block-id]'))
}

export function createLocatorFromCurrentPosition(context: LocatorNavigationContext): ReaderLocator {
  const section = context.sections[Math.min(Math.max(context.sectionIndex, 0), Math.max(context.sections.length - 1, 0))]
  const elements = blockElements(context.root, section?.id)
  const viewportTop = typeof window === 'undefined' ? 0 : window.innerHeight * 0.12
  const element = elements.find((candidate) => candidate.getBoundingClientRect().bottom > viewportTop) ?? elements.at(-1)
  const blockId = element?.dataset.readerBlockId
  const maximum = typeof document === 'undefined' || typeof window === 'undefined' ? 1 : Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
  const progression = typeof window === 'undefined' ? 0 : Math.min(1, Math.max(0, window.scrollY / maximum))
  const locator: ReflowableReaderLocator = { version: 1, kind: 'reflowable', resourceKey: context.resourceKey, sectionId: section?.id ?? 'section-0', sectionIndex: context.sectionIndex, ...(blockId ? { blockId } : { progression }) }
  return locator
}

export function navigateToLocator(locator: ReaderLocator, context: LocatorNavigationContext & { onSectionChange?: (index: number) => void }): boolean {
  const resolved = resolveReaderLocator(locator, { resourceKey: context.resourceKey, sections: context.sections })
  const index = resolved.sectionIndex ?? 0
  if (index !== context.sectionIndex) {
    context.onSectionChange?.(index)
    return false
  }
  const targetId = resolved.blockId
  if (targetId) {
    const target = blockElements(context.root, resolved.locator.kind === 'reflowable' ? resolved.locator.sectionId : undefined).find((candidate) => candidate.dataset.readerBlockId === targetId)
    if (target) { target.scrollIntoView({ block: 'start', behavior: 'auto' }); return true }
  }
  const progression = resolved.locator.kind === 'reflowable' ? resolved.locator.progression ?? 0 : 0
  const maximum = Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
  window.scrollTo({ top: maximum * progression, behavior: 'auto' })
  return false
}

export function safeLocatorForResource(locator: unknown, resourceKey: string, sections: LocatorNavigationContext['sections']) {
  return normalizeReaderLocator(locator) && resolveReaderLocator(locator, { resourceKey, sections }).locator
}

export class ReaderNavigationHistory {
  private readonly entries: ReaderLocator[] = []
  push(locator: ReaderLocator) { const normalized = normalizeReaderLocator(locator); if (normalized) this.entries.push(normalized) }
  back() { return this.entries.pop() }
  canGoBack() { return this.entries.length > 0 }
  clear() { this.entries.length = 0 }
}

export function createNavigationHistory() { return new ReaderNavigationHistory() }
