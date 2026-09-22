import { type MouseEvent, type ReactNode } from 'react'
import type { DocumentBlock, DocumentInternalLink } from '../../../domain/documents'

function safeText(block: DocumentBlock, onInternalLink?: (link: DocumentInternalLink, anchor: HTMLAnchorElement) => void): ReactNode {
  const links = block.links ?? []
  if (!links.length) return block.text
  const ordered = [...links].sort((left, right) => left.start - right.start || left.end - right.end)
  const boundary = (offset: number) => offset === 0 || offset === block.text.length || (block.text.charCodeAt(offset - 1) < 0xd800 || block.text.charCodeAt(offset - 1) > 0xdbff)
  if (ordered.some((link, index) => !Number.isInteger(link.start) || !Number.isInteger(link.end) || link.start < 0 || link.end > block.text.length || link.start >= link.end || !boundary(link.start) || !boundary(link.end) || !link.target.sectionId || (index > 0 && link.start < ordered[index - 1].end))) return block.text
  const nodes: ReactNode[] = []; let cursor = 0
  for (const link of ordered) {
    if (link.start > cursor) nodes.push(block.text.slice(cursor, link.start))
    const label = link.role === 'noteref' ? 'Footnote' : 'Internal link'
    nodes.push(<a aria-label={`${label}: ${block.text.slice(link.start, link.end)}`} data-internal-link-id={link.id} href={`#${link.target.sectionId}${link.target.blockId ? `:${link.target.blockId}` : ''}`} key={link.id} onClick={(event: MouseEvent<HTMLAnchorElement>) => { event.preventDefault(); event.stopPropagation(); onInternalLink?.(link, event.currentTarget) }} onKeyDown={(event) => { if (event.key === 'Enter') event.stopPropagation() }}>{block.text.slice(link.start, link.end)}</a>)
    cursor = link.end
  }
  if (cursor < block.text.length) nodes.push(block.text.slice(cursor))
  return <>{nodes}</>
}

function renderBlock(block: DocumentBlock, onInternalLink?: (link: DocumentInternalLink, anchor: HTMLAnchorElement) => void, highlighted = false): ReactNode {
  if (block.type === 'heading') {
    const Heading = `h${block.level}` as const
    return <Heading className={highlighted ? 'reader-block--target' : undefined} data-reader-block-id={block.id} key={block.id}>{safeText(block, onInternalLink)}</Heading>
  }
  if (block.type === 'blockquote') return <blockquote className={highlighted ? 'reader-block--target' : undefined} data-reader-block-id={block.id} key={block.id}>{safeText(block, onInternalLink)}</blockquote>
  if (block.type === 'page-break') return <hr aria-label="Page break" className={highlighted ? 'reader-block--target' : undefined} data-reader-block-id={block.id} key={block.id} />
  return <p className={highlighted ? 'reader-block--target' : undefined} data-reader-block-id={block.id} key={block.id}>{safeText(block, onInternalLink)}</p>
}

export function DocumentBlockRenderer({ blocks, onInternalLink, highlightBlockId }: { blocks: DocumentBlock[]; onInternalLink?: (link: DocumentInternalLink, anchor: HTMLAnchorElement) => void; highlightBlockId?: string }) {
  const nodes: ReactNode[] = []
  let listItems: Extract<DocumentBlock, { type: 'list-item' }>[] = []
  let ordered: boolean | undefined
  const flushList = () => {
    if (!listItems.length || ordered === undefined) return
    const List = ordered ? 'ol' : 'ul'
    nodes.push(<List key={`list-${listItems[0].id}`}>{listItems.map((item) => <li className={item.id === highlightBlockId ? 'reader-block--target' : undefined} data-reader-block-id={item.id} key={item.id}>{safeText(item, onInternalLink)}</li>)}</List>)
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
    nodes.push(renderBlock(block, onInternalLink, highlightBlockId === block.id))
  }
  flushList()
  return <>{nodes}</>
}
