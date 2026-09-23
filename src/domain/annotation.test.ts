import { describe, expect, it } from 'vitest'
import { annotationAnchorKey, annotationFromInput, findAnnotationOverlap, type ReaderAnnotation, type TextAnchorSegment } from './annotation'

const segment = (startOffset: number, endOffset: number): TextAnchorSegment => ({ sectionId: 'chapter', sectionIndex: 0, blockId: 'block-0', blockOrder: 0, startOffset, endOffset, exact: 'x'.repeat(endOffset - startOffset), prefix: '', suffix: '' })

describe('annotation anchors and overlap', () => {
  it('canonicalizes anchor keys and note length from normalized segments', () => {
    const input = { resourceKey: 'imported:book', segments: [segment(3.2, 5.8)], quote: 'xx', color: 'lavender' as const, anchorKey: 'untrusted', note: 'n'.repeat(4_500) }
    const annotation = annotationFromInput(input)
    expect(annotation.anchorKey).toBe(annotationAnchorKey(annotation.segments))
    expect(annotation.anchorKey).not.toBe('untrusted')
    expect(annotation.segments[0]).toMatchObject({ startOffset: 3, endOffset: 6, blockOrder: 0 })
    expect(annotation.note).toHaveLength(4_000)
  })

  it('allows adjacent anchors, reports partial overlap, and ignores orphaned records', () => {
    const annotation: ReaderAnnotation = { id: 'existing', resourceKey: 'imported:book', anchorKey: 'existing', segments: [segment(0, 5)], quote: 'xxxxx', color: 'lavender', createdAt: 1, updatedAt: 1 }
    expect(findAnnotationOverlap([annotation], [segment(5, 8)])).toBeUndefined()
    expect(findAnnotationOverlap([annotation], [segment(4, 8)])).toEqual(annotation)
    expect(findAnnotationOverlap([{ ...annotation, orphaned: true }], [segment(4, 8)])).toBeUndefined()
  })
})
