import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { DocumentBlock } from '../../../domain/documents'
import { DocumentBlockRenderer } from './DocumentBlockRenderer'

const blocks: DocumentBlock[] = [
  { id: 'heading', type: 'heading', text: 'Start', level: 2, order: 0 },
  { id: 'unordered-one', type: 'list-item', text: 'One', ordered: false, order: 1 },
  { id: 'unordered-two', type: 'list-item', text: 'Two', ordered: false, order: 2 },
  { id: 'ordered-one', type: 'list-item', text: 'Three', ordered: true, order: 3 },
  { id: 'quote', type: 'blockquote', text: 'Pause', order: 4 },
  { id: 'ordered-two', type: 'list-item', text: 'Four', ordered: true, order: 5 },
  { id: 'break', type: 'page-break', text: '', order: 6 },
  { id: 'unordered-three', type: 'list-item', text: 'Five', ordered: false, order: 7 },
  { id: 'paragraph', type: 'paragraph', text: 'End', order: 8 },
]

describe('DocumentBlockRenderer', () => {
  it('groups only consecutive matching list items into valid lists while preserving mixed block order', () => {
    expect(renderToStaticMarkup(<DocumentBlockRenderer blocks={blocks} />)).toBe('<h2>Start</h2><ul><li>One</li><li>Two</li></ul><ol><li>Three</li></ol><blockquote>Pause</blockquote><ol><li>Four</li></ol><hr aria-label="Page break"/><ul><li>Five</li></ul><p>End</p>')
  })
})
