import { type KeyboardEvent, type MouseEvent, type ReactNode } from 'react'
import type { DocumentBlock, DocumentInternalLink } from '../../../domain/documents'
import type { AnnotationColor, ReaderAnnotation } from '../../../domain/annotation'

type AnnotationMark = { annotation: ReaderAnnotation; start: number; end: number; color: AnnotationColor }
type RendererProps = { annotations?: ReaderAnnotation[]; sectionId?: string; onAnnotationClick?: (annotation: ReaderAnnotation, target: HTMLElement) => void }
function isBoundary(text: string, offset: number) { if (offset === 0 || offset === text.length) return true; const previous = text.charCodeAt(offset - 1); const current = text.charCodeAt(offset); return !(previous >= 0xd800 && previous <= 0xdbff && current >= 0xdc00 && current <= 0xdfff) }
function validLinks(block: DocumentBlock) { const links = [...(block.links ?? [])].sort((left, right) => left.start - right.start || left.end - right.end); return links.length && !links.some((link, index) => !Number.isInteger(link.start) || !Number.isInteger(link.end) || link.start < 0 || link.end > block.text.length || link.start >= link.end || !isBoundary(block.text, link.start) || !isBoundary(block.text, link.end) || !link.target.sectionId || (index > 0 && link.start < links[index - 1].end)) ? links : [] }
function validAnnotations(block: DocumentBlock, annotations: ReaderAnnotation[] | undefined, sectionId?: string): AnnotationMark[] { return (annotations ?? []).flatMap((annotation) => annotation.segments.filter((segment) => segment.blockId === block.id && segment.sectionId === sectionId).flatMap((segment) => segment.startOffset >= 0 && segment.endOffset <= block.text.length && segment.startOffset < segment.endOffset && isBoundary(block.text, segment.startOffset) && isBoundary(block.text, segment.endOffset) ? [{ annotation, start: segment.startOffset, end: segment.endOffset, color: annotation.color }] : [])) }
function interactiveMark(annotation: ReaderAnnotation, text: string, onAnnotationClick?: RendererProps['onAnnotationClick'], key?: string): ReactNode { const click = (event: MouseEvent<HTMLElement>) => { event.stopPropagation(); onAnnotationClick?.(annotation, event.currentTarget) }; const keyboard = (event: KeyboardEvent<HTMLElement>) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); click(event as unknown as MouseEvent<HTMLElement>) } }; return <mark aria-label={`Highlighted text${annotation.note ? ', has note' : ''}. Click to edit.`} className={`reader-annotation reader-annotation--${annotation.color}`} data-annotation-id={annotation.id} key={key ?? annotation.id} onClick={click} onKeyDown={keyboard} role="button" tabIndex={0}>{text}</mark> }
function safeText(block: DocumentBlock, onInternalLink?: (link: DocumentInternalLink, anchor: HTMLAnchorElement) => void, rendererProps: RendererProps = {}): ReactNode {
  const links = validLinks(block); const annotations = validAnnotations(block, rendererProps.annotations, rendererProps.sectionId); if (!links.length && !annotations.length) return block.text
  const boundaries = [...new Set([0, block.text.length, ...links.flatMap((link) => [link.start, link.end]), ...annotations.flatMap((mark) => [mark.start, mark.end])])].sort((left, right) => left - right); const nodes: ReactNode[] = []
  for (let index = 0; index < boundaries.length - 1; index += 1) { const start = boundaries[index]; const end = boundaries[index + 1]; if (start === end) continue; const text = block.text.slice(start, end); const link = links.find((candidate) => candidate.start <= start && end <= candidate.end); const annotation = annotations.find((candidate) => candidate.start <= start && end <= candidate.end); let node: ReactNode = text
    if (link) { const label = link.role === 'noteref' ? 'Footnote' : 'Internal link'; const anchor = <a aria-label={`${label}: ${text}`} data-internal-link-id={link.id} href={`#${link.target.sectionId}${link.target.blockId ? `:${link.target.blockId}` : ''}`} key={`${link.id}-${start}`} onClick={(event: MouseEvent<HTMLAnchorElement>) => { event.preventDefault(); event.stopPropagation(); onInternalLink?.(link, event.currentTarget) }} onKeyDown={(event) => { if (event.key === 'Enter') event.stopPropagation() }}>{text}</a>; node = annotation ? <mark aria-label={`Highlighted text${annotation.annotation.note ? ', has note' : ''}. Link interaction is available.`} className={`reader-annotation reader-annotation--${annotation.color}`} data-annotation-id={annotation.annotation.id} key={`${annotation.annotation.id}-${link.id}-${start}`}>{anchor}</mark> : anchor }
    else if (annotation) node = interactiveMark(annotation.annotation, text, rendererProps.onAnnotationClick, `${annotation.annotation.id}-${start}`)
    nodes.push(node)
  }
  return <>{nodes}</>
}

function renderBlock(block: DocumentBlock, onInternalLink?: (link: DocumentInternalLink, anchor: HTMLAnchorElement) => void, highlighted = false, rendererProps: RendererProps = {}): ReactNode {
  const content = safeText(block, onInternalLink, rendererProps)
  if (block.type === 'heading') { const Heading = `h${block.level}` as const; return <Heading className={highlighted ? 'reader-block--target' : undefined} data-reader-block-id={block.id} key={block.id}>{content}</Heading> }
  if (block.type === 'blockquote') return <blockquote className={highlighted ? 'reader-block--target' : undefined} data-reader-block-id={block.id} key={block.id}>{content}</blockquote>
  if (block.type === 'page-break') return <hr aria-label="Page break" className={highlighted ? 'reader-block--target' : undefined} data-reader-block-id={block.id} key={block.id} />
  return <p className={highlighted ? 'reader-block--target' : undefined} data-reader-block-id={block.id} key={block.id}>{content}</p>
}

export function DocumentBlockRenderer({ blocks, onInternalLink, highlightBlockId, annotations, sectionId, onAnnotationClick }: { blocks: DocumentBlock[]; onInternalLink?: (link: DocumentInternalLink, anchor: HTMLAnchorElement) => void; highlightBlockId?: string } & RendererProps) {
  const nodes: ReactNode[] = []
  let listItems: Extract<DocumentBlock, { type: 'list-item' }>[] = []
  let ordered: boolean | undefined
  const rendererProps = { annotations, sectionId, onAnnotationClick }
  const flushList = () => {
    if (!listItems.length || ordered === undefined) return
    const List = ordered ? 'ol' : 'ul'
    nodes.push(<List key={`list-${listItems[0].id}`}>{listItems.map((item) => <li className={item.id === highlightBlockId ? 'reader-block--target' : undefined} data-reader-block-id={item.id} key={item.id}>{safeText(item, onInternalLink, rendererProps)}</li>)}</List>)
    listItems = []
    ordered = undefined
  }
  for (const block of blocks) {
    if (block.type === 'list-item') {
      if (listItems.length && ordered !== block.ordered) flushList()
      ordered = block.ordered
      listItems.push(block)
      continue
    }
    flushList()
    nodes.push(renderBlock(block, onInternalLink, highlightBlockId === block.id, rendererProps))
  }
  flushList()
  return <>{nodes}</>
}
