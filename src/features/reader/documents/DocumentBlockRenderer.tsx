import { type ReactNode } from 'react'
import type { DocumentBlock } from '../../../domain/documents'

function renderBlock(block: DocumentBlock): ReactNode {
  if (block.type === 'heading') {
    const Heading = `h${block.level}` as const
    return <Heading key={block.id}>{block.text}</Heading>
  }
  if (block.type === 'blockquote') return <blockquote key={block.id}>{block.text}</blockquote>
  if (block.type === 'page-break') return <hr aria-label="Page break" key={block.id} />
  return <p key={block.id}>{block.text}</p>
}

export function DocumentBlockRenderer({ blocks }: { blocks: DocumentBlock[] }) {
  const nodes: ReactNode[] = []
  let listItems: Extract<DocumentBlock, { type: 'list-item' }>[] = []
  let ordered: boolean | undefined
  const flushList = () => {
    if (!listItems.length || ordered === undefined) return
    const List = ordered ? 'ol' : 'ul'
    nodes.push(<List key={`list-${listItems[0].id}`}>{listItems.map((item) => <li key={item.id}>{item.text}</li>)}</List>)
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
    nodes.push(renderBlock(block))
  }
  flushList()
  return <>{nodes}</>
}
