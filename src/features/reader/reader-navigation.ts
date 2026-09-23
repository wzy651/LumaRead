import type { DocumentSection } from '../../domain/documents'
import type { ReaderLocator, ReflowableReaderLocator } from '../../domain/reader-locator'
import { normalizeReaderLocator, resolveReaderLocator } from '../../domain/reader-locator'

export interface LocatorNavigationContext {
  resourceKey: string
  sections: Pick<DocumentSection, 'id' | 'blocks'>[]
  sectionIndex: number
  root?: ParentNode
  pageContainer?: HTMLElement
}

function sectionRoot(root: ParentNode, sectionId?: string): ParentNode {
  if (!sectionId) return root
  if (root instanceof HTMLElement && root.dataset.readerSectionId === sectionId) return root
  return Array.from(root.querySelectorAll<HTMLElement>('[data-reader-section-id]')).find((candidate) => candidate.dataset.readerSectionId === sectionId) ?? root
}

function blockElements(root: ParentNode = document, sectionId?: string) {
  return Array.from(sectionRoot(root, sectionId).querySelectorAll<HTMLElement>('[data-reader-block-id]'))
}

function textOffsetOnPage(element: HTMLElement, pageContainer: HTMLElement) {
  if (typeof document.createRange().getBoundingClientRect !== 'function') return undefined
  const style = getComputedStyle(pageContainer)
  const stride = (Number.parseFloat(style.columnWidth) || pageContainer.clientWidth) + (Number.parseFloat(style.columnGap) || 0)
  const padding = Number.parseFloat(style.paddingLeft) || 0
  if (stride <= 0) return undefined
  const page = Math.max(0, Math.floor((pageContainer.scrollLeft + padding) / stride))
  const containerLeft = pageContainer.getBoundingClientRect().left
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
  let total = 0
  let current = walker.nextNode()
  while (current) {
    const nodeLength = current.textContent?.length ?? 0
    if (nodeLength > 0) {
      const range = document.createRange()
      const columnAt = (offset: number) => {
        range.setStart(current!, offset)
        range.setEnd(current!, Math.min(nodeLength, offset + 1))
        const rect = range.getBoundingClientRect()
        if (!rect || !Number.isFinite(rect.left)) return undefined
        return Math.floor((rect.left - containerLeft + pageContainer.scrollLeft - padding) / stride)
      }
      const lastColumn = columnAt(nodeLength - 1)
      if (lastColumn !== undefined && lastColumn >= page) {
        let low = 0
        let high = nodeLength - 1
        while (low < high) {
          const middle = Math.floor((low + high) / 2)
          const column = columnAt(middle)
          if (column === undefined || column >= page) high = middle
          else low = middle + 1
        }
        return total + low
      }
      total += nodeLength
    }
    current = walker.nextNode()
  }
  return undefined
}

export function createLocatorFromCurrentPosition(context: LocatorNavigationContext): ReaderLocator {
  const section = context.sections[Math.min(Math.max(context.sectionIndex, 0), Math.max(context.sections.length - 1, 0))]
  const elements = blockElements(context.root, section?.id)
  const pageContainer = context.pageContainer
  const viewportTop = pageContainer ? pageContainer.getBoundingClientRect().top + 24 : typeof window === 'undefined' ? 0 : window.innerHeight * 0.12
  const element = elements.find((candidate) => { const rect = candidate.getBoundingClientRect(); const viewport = pageContainer?.getBoundingClientRect(); return pageContainer && viewport ? rect.right > viewport.left + 16 && rect.left < viewport.right - 16 : rect.bottom > viewportTop }) ?? elements.at(-1)
  const blockId = element?.dataset.readerBlockId
  const maximum = typeof document === 'undefined' || typeof window === 'undefined' ? 1 : Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
  const progression = typeof window === 'undefined' ? 0 : Math.min(1, Math.max(0, window.scrollY / maximum))
  let textOffset: number | undefined
  if (element && pageContainer) textOffset = textOffsetOnPage(element, pageContainer)
  else if (element) {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
    let offset = 0
    let node = walker.nextNode()
    while (node) {
      const text = node.textContent ?? ''
      for (let index = 0; index < text.length; index += 1) {
        const range = document.createRange(); range.setStart(node, index); range.setEnd(node, index + 1)
        const rect = typeof range.getBoundingClientRect === 'function' ? range.getBoundingClientRect() : undefined
        if (!rect) { textOffset = 0; break }
        const viewport = pageContainer?.getBoundingClientRect()
        if (pageContainer && viewport ? rect.right > viewport.left + 16 && rect.left < viewport.right - 16 : rect.bottom > viewportTop) { textOffset = offset + index; break }
      }
      if (textOffset !== undefined) break
      offset += text.length; node = walker.nextNode()
    }
  }
  const locator: ReflowableReaderLocator = { version: 1, kind: 'reflowable', resourceKey: context.resourceKey, sectionId: section?.id ?? 'section-0', sectionIndex: context.sectionIndex, ...(blockId ? { blockId, ...(textOffset !== undefined ? { textOffset } : {}) } : { progression }) }
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
    if (target) {
      const offset = resolved.locator.kind === 'reflowable' ? resolved.locator.textOffset : undefined
      if (offset !== undefined) {
        const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT); let remaining = offset; let node = walker.nextNode()
        while (node) { const length = node.textContent?.length ?? 0; if (remaining <= length) { const range = document.createRange(); range.setStart(node, remaining); range.setEnd(node, Math.min(length, remaining + 1)); const rect = typeof range.getBoundingClientRect === 'function' ? range.getBoundingClientRect() : undefined; if (rect) { if (context.pageContainer) { const style = getComputedStyle(context.pageContainer); const stride = (Number.parseFloat(style.columnWidth) || context.pageContainer.clientWidth) + (Number.parseFloat(style.columnGap) || 0); const padding = Number.parseFloat(style.paddingLeft) || 0; const page = Math.max(0, Math.floor((rect.left - context.pageContainer.getBoundingClientRect().left + context.pageContainer.scrollLeft - padding) / Math.max(1, stride))); context.pageContainer.scrollTo({ left: page * stride, behavior: 'auto' }) } else window.scrollTo({ top: Math.max(0, window.scrollY + rect.top - window.innerHeight * 0.12), behavior: 'auto' }); return true } break } remaining -= length; node = walker.nextNode() }
      }
      if (context.pageContainer) { const rect = target.getBoundingClientRect(); const style = getComputedStyle(context.pageContainer); const stride = (Number.parseFloat(style.columnWidth) || context.pageContainer.clientWidth) + (Number.parseFloat(style.columnGap) || 0); const padding = Number.parseFloat(style.paddingLeft) || 0; const page = Math.max(0, Math.floor((rect.left - context.pageContainer.getBoundingClientRect().left + context.pageContainer.scrollLeft - padding) / Math.max(1, stride))); context.pageContainer.scrollTo({ left: page * stride, behavior: 'auto' }) }
      else target.scrollIntoView({ block: 'start', behavior: 'auto' })
      return true
    }
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
