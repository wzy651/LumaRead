import { describe, expect, it } from 'vitest'
import type { DocumentSection } from '../../../domain/documents'
import { resolveSectionIndex } from './section-location'
const sections: DocumentSection[] = [{ id: 'one', order: 0, blocks: [] }, { id: 'two', order: 1, blocks: [] }]
describe('document section location', () => {
  it('restores a matching section id and safely falls back when it is missing', () => { expect(resolveSectionIndex(sections, { documentId: 'd', sectionId: 'two', sectionIndex: 0, progressPercent: 0, updatedAt: '' })).toBe(1); expect(resolveSectionIndex(sections, { documentId: 'd', sectionId: 'gone', sectionIndex: 99, progressPercent: 0, updatedAt: '' })).toBe(1); expect(resolveSectionIndex(sections, { documentId: 'd', sectionId: 'gone', sectionIndex: -1, progressPercent: 0, updatedAt: '' })).toBe(0) })
})
