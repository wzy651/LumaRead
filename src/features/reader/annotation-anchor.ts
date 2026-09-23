import type { DocumentBlock, DocumentSection } from '../../domain/documents'
import { annotationAnchorKey, annotationContextLength, maxAnnotationQuoteLength, normalizeTextAnchorSegments, type ReaderAnnotation, type TextAnchorSegment } from '../../domain/annotation'

type SelectionLike = Pick<Selection, 'isCollapsed' | 'rangeCount' | 'getRangeAt' | 'toString'>
type AnchorOptions = { sections: DocumentSection[]; root?: ParentNode }
type BlockInfo = { element: HTMLElement; block: DocumentBlock; section: DocumentSection; sectionIndex: number }

const ignoredSelectionSelector = 'input, textarea, select, button, [contenteditable="true"], .reader-panel, .reader-chrome, .reader-topbar'

function elementForNode(node: Node): Element | undefined {
  return node instanceof Element ? node : node.parentElement ?? undefined
}

function blockInfoForNode(node: Node, sections: DocumentSection[], root: ParentNode): BlockInfo | undefined {
  const element = elementForNode(node)?.closest<HTMLElement>('[data-reader-block-id]')
  if (!element || (root instanceof Node && !root.contains(element))) return undefined
  const blockId = element.dataset.readerBlockId
  const article = element.closest<HTMLElement>('[data-reader-section-id]')
  const sectionId = article?.dataset.readerSectionId
  if (!blockId || !sectionId) return undefined
  const sectionIndex = sections.findIndex((section) => section.id === sectionId)
  const block = sectionIndex >= 0 ? sections[sectionIndex].blocks.find((candidate) => candidate.id === blockId) : undefined
  return block && article ? { element, block, section: sections[sectionIndex], sectionIndex } : undefined
}

function offsetInElement(element: HTMLElement, container: Node, offset: number) {
  const range = document.createRange()
  range.selectNodeContents(element)
  range.setEnd(container, offset)
  return range.toString().length
}

function safelyClampOffset(offset: number, text: string) {
  let next = Math.max(0, Math.min(text.length, offset))
  if (next > 0 && next < text.length) {
    const previous = text.charCodeAt(next - 1)
    const current = text.charCodeAt(next)
    if (previous >= 0xd800 && previous <= 0xdbff && current >= 0xdc00 && current <= 0xdfff) next -= 1
  }
  return next
}

function segmentForBlock(info: BlockInfo, range: Range, startInfo: BlockInfo, endInfo: BlockInfo): TextAnchorSegment | undefined {
  const start = info.block.id === startInfo.block.id ? offsetInElement(info.element, range.startContainer, range.startOffset) : 0
  const end = info.block.id === endInfo.block.id ? offsetInElement(info.element, range.endContainer, range.endOffset) : info.block.text.length
  const startOffset = safelyClampOffset(start, info.block.text)
  const endOffset = safelyClampOffset(end, info.block.text)
  if (startOffset >= endOffset) return undefined
  return { sectionId: info.section.id, sectionIndex: info.sectionIndex, blockId: info.block.id, blockOrder: info.block.order, startOffset, endOffset, exact: info.block.text.slice(startOffset, endOffset), prefix: info.block.text.slice(Math.max(0, startOffset - annotationContextLength), startOffset), suffix: info.block.text.slice(endOffset, endOffset + annotationContextLength) }
}

function allBlocks(root: ParentNode, sections: DocumentSection[]) {
  return Array.from(root.querySelectorAll<HTMLElement>('[data-reader-block-id]')).flatMap((element) => {
    const info = blockInfoForNode(element, sections, root)
    return info ? [info] : []
  })
}

export function createTextAnchorFromSelection(selection: SelectionLike | null, options: AnchorOptions): { segments: TextAnchorSegment[]; quote: string; anchorKey: string } | { reason: 'empty' | 'outside-reader' | 'cross-section' | 'unsupported' } {
  if (!selection || selection.isCollapsed || !selection.rangeCount) return { reason: 'empty' }
  const range = selection.getRangeAt(0)
  const root = options.root ?? document
  const startElement = elementForNode(range.startContainer)
  const endElement = elementForNode(range.endContainer)
  if (!startElement || !endElement || startElement.closest(ignoredSelectionSelector) || endElement.closest(ignoredSelectionSelector)) return { reason: 'outside-reader' }
  const startInfo = blockInfoForNode(range.startContainer, options.sections, root)
  const endInfo = blockInfoForNode(range.endContainer, options.sections, root)
  if (!startInfo || !endInfo) return { reason: 'outside-reader' }
  if (startInfo.section.id !== endInfo.section.id) return { reason: 'cross-section' }
  const infos = allBlocks(root, options.sections).filter((info) => info.section.id === startInfo.section.id)
  const startIndex = infos.findIndex((info) => info.block.id === startInfo.block.id)
  const endIndex = infos.findIndex((info) => info.block.id === endInfo.block.id)
  if (startIndex < 0 || endIndex < startIndex) return { reason: 'unsupported' }
  const segments = infos.slice(startIndex, endIndex + 1).flatMap((info) => { const segment = segmentForBlock(info, range, startInfo, endInfo); return segment ? [segment] : [] })
  if (!segments.length) return { reason: 'empty' }
  const normalized = normalizeTextAnchorSegments(segments)
  const quote = normalized.map((segment) => segment.exact).join('\n\n').slice(0, maxAnnotationQuoteLength)
  return { segments: normalized, quote, anchorKey: annotationAnchorKey(normalized) }
}

export const selectionToTextAnchor = createTextAnchorFromSelection
export const selectionToAnnotationAnchor = createTextAnchorFromSelection

function contextScore(text: string, index: number, exact: string, prefix: string, suffix: string) {
  let score = 0
  if (prefix && text.slice(Math.max(0, index - prefix.length), index).endsWith(prefix)) score += 1
  if (suffix && text.slice(index + exact.length, index + exact.length + suffix.length).startsWith(suffix)) score += 1
  return score
}

function candidateOffsets(text: string, exact: string, prefix: string, suffix: string) {
  const candidates: Array<{ start: number; end: number; score: number }> = []
  let from = 0
  while (exact && from <= text.length) {
    const start = text.indexOf(exact, from)
    if (start < 0) break
    candidates.push({ start, end: start + exact.length, score: contextScore(text, start, exact, prefix, suffix) })
    from = start + Math.max(1, exact.length)
  }
  return candidates
}

function findBlock(sections: DocumentSection[], segment: TextAnchorSegment) {
  const sectionIndex = sections.findIndex((section) => section.id === segment.sectionId)
  const section = sectionIndex >= 0 ? sections[sectionIndex] : sections[segment.sectionIndex]
  const block = section?.blocks.find((candidate) => candidate.id === segment.blockId)
  return section && block ? { section, sectionIndex: sections.indexOf(section), block } : undefined
}

export type AnnotationRecovery = { annotation: ReaderAnnotation; status: 'recovered' | 'orphaned'; segments: TextAnchorSegment[] }

export function recoverAnnotation(annotation: ReaderAnnotation, sections: DocumentSection[]): AnnotationRecovery {
  const recovered: TextAnchorSegment[] = []
  let status: AnnotationRecovery['status'] = 'recovered'
  for (const segment of annotation.segments) {
    const exactBlock = findBlock(sections, segment)
    const originalText = exactBlock?.block.text
    let resolved: TextAnchorSegment | undefined
    if (originalText && originalText.slice(segment.startOffset, segment.endOffset) === segment.exact) resolved = { ...segment, sectionIndex: sections.indexOf(exactBlock.section), blockOrder: exactBlock.block.order }
    if (!resolved && originalText) {
      const candidates = candidateOffsets(originalText, segment.exact, segment.prefix, segment.suffix)
      const bestScore = Math.max(...candidates.map((candidate) => candidate.score), -1)
      const best = candidates.filter((candidate) => candidate.score === bestScore)
      if (best.length === 1) { const candidate = best[0]; resolved = { ...segment, sectionIndex: sections.indexOf(exactBlock.section), blockOrder: exactBlock.block.order, startOffset: candidate.start, endOffset: candidate.end, prefix: originalText.slice(Math.max(0, candidate.start - annotationContextLength), candidate.start), suffix: originalText.slice(candidate.end, candidate.end + annotationContextLength) } }
    }
    if (!resolved) {
      const section = sections.find((candidate) => candidate.id === segment.sectionId)
      const matches = section?.blocks.flatMap((block) => candidateOffsets(block.text, segment.exact, segment.prefix, segment.suffix).map((candidate) => ({ block, candidate }))) ?? []
      const bestScore = Math.max(...matches.map((match) => match.candidate.score), -1)
      const best = matches.filter((match) => match.candidate.score === bestScore)
      if (best.length === 1) { const match = best[0]; resolved = { ...segment, sectionIndex: sections.indexOf(section!), blockId: match.block.id, blockOrder: match.block.order, startOffset: match.candidate.start, endOffset: match.candidate.end, prefix: match.block.text.slice(Math.max(0, match.candidate.start - annotationContextLength), match.candidate.start), suffix: match.block.text.slice(match.candidate.end, match.candidate.end + annotationContextLength) } }
    }
    if (resolved) recovered.push(resolved)
    else status = 'orphaned'
  }
  if (status === 'orphaned' || recovered.length !== annotation.segments.length) return { annotation: { ...annotation, orphaned: true }, status: 'orphaned', segments: recovered }
  const next = { ...annotation, orphaned: undefined, segments: normalizeTextAnchorSegments(recovered), anchorKey: annotationAnchorKey(recovered), updatedAt: annotation.updatedAt }
  return { annotation: next, status, segments: next.segments }
}
