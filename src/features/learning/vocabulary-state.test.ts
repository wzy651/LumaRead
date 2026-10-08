import { describe, expect, it } from 'vitest'
import { applyVocabularyAction, createLearningTerm, getVocabularyState, serializeLearningTerm } from './vocabulary-state'
import type { LearningTerm, VocabularyState } from './types'

const example = { text: 'bank', sentence: 'The river bank.', resourceKey: 'one', bookTitle: 'One' }
const legacy: LearningTerm = { normalized: 'bank', text: 'bank', status: 'unknown', lookups: 2, lastSeen: '2026-10-05T00:00:00.000Z', example }
const now = new Date('2026-10-05T12:00:00.000Z')
const state: VocabularyState = { proficiency: 'unknown', learningEnabled: false, basis: 'unassessed', revision: 0 }

describe('vocabulary state compatibility boundary', () => {
  it.each([
    ['unknown', 'unknown', false, 'unassessed'],
    ['learning', 'unknown', true, 'unassessed'],
    ['recognized', 'recognized', false, 'legacy'],
    ['active', 'active', false, 'legacy'],
  ] as const)('interprets old %s without inventing evidence or mutating it', (status, proficiency, learningEnabled, basis) => {
    const term = { ...legacy, status }, before = structuredClone(term)
    expect(getVocabularyState(term)).toEqual({ proficiency, learningEnabled, basis, revision: 0 })
    expect(term).toEqual(before)
    expect(term).not.toHaveProperty('vocabularyState')
  })

  it.each([
    ['unknown', false, 'unknown'], ['unknown', true, 'learning'],
    ['recognized', false, 'recognized'], ['recognized', true, 'learning'],
    ['active', false, 'active'], ['active', true, 'learning'],
  ] as const)('serializes %s / learning=%s using only the new source of truth', (proficiency, learningEnabled, mirror) => {
    const term = { ...legacy, status: 'active' as const, vocabularyState: { ...state, proficiency, learningEnabled } }
    expect(getVocabularyState(term)).toEqual(term.vocabularyState)
    const stored = serializeLearningTerm(term)
    expect(stored.status).toBe(mirror)
    expect(stored.vocabularyState).toEqual(term.vocabularyState)
    expect(term.status).toBe('active')
  })

  it.each([null, undefined, {}, { ...state, revision: -1 }, { ...state, revision: 0.5 }, { ...state, proficiency: 'fluent' }, { ...state, learningEnabled: 'yes' }, { ...state, basis: 'fsrs' }, { ...state, assessedAt: 'bad' }])('never falls back to legacy status for damaged new state %j', (damaged) => {
    const term = { ...legacy, status: 'learning', vocabularyState: damaged } as unknown as LearningTerm
    const before = structuredClone(term)
    expect(getVocabularyState(term)).toBeUndefined()
    expect(() => applyVocabularyAction(term, { type: 'unenroll' }, now)).toThrow()
    expect(() => serializeLearningTerm(term)).toThrow()
    expect(term).toEqual(before)
  })

  it('initializes only new terms with a complete unassessed state', () => {
    const term = createLearningTerm({ normalized: legacy.normalized, text: legacy.text, lookups: legacy.lookups, lastSeen: legacy.lastSeen, example: legacy.example })
    expect(term.vocabularyState).toEqual(state)
    expect(term.status).toBe('unknown')
  })

  it.each(['recognized', 'active'] as const)('retains historical %s through enrollment and removal', (proficiency) => {
    const enrolled = applyVocabularyAction({ ...legacy, status: proficiency }, { type: 'enroll' }, now)
    expect(enrolled.status).toBe('learning')
    expect(enrolled.vocabularyState).toEqual({ proficiency, learningEnabled: true, basis: 'legacy', revision: 1 })
    const removed = applyVocabularyAction(enrolled, { type: 'unenroll' }, now)
    expect(removed.status).toBe(proficiency)
    expect(removed.vocabularyState).toEqual({ proficiency, learningEnabled: false, basis: 'legacy', revision: 2 })
    expect(removed.candidateExcluded).toBe(true)
    expect(applyVocabularyAction(removed, { type: 'enroll' }, now).candidateExcluded).toBeUndefined()
  })

  it('self assessment preserves enrollment and exclusion; a combined action explicitly pauses', () => {
    const term = { ...legacy, vocabularyState: { ...state, learningEnabled: true }, candidateExcluded: true }
    const assessed = applyVocabularyAction(term, { type: 'assess', level: 'active' }, now)
    expect(assessed.vocabularyState).toEqual({ proficiency: 'active', learningEnabled: true, basis: 'self', assessedAt: now.toISOString(), revision: 1 })
    expect(assessed.candidateExcluded).toBe(true)
    expect(assessed.status).toBe('learning')
    const paused = applyVocabularyAction(assessed, { type: 'assess-and-unenroll', level: 'recognized' }, now)
    expect(paused.vocabularyState).toMatchObject({ proficiency: 'recognized', learningEnabled: false, revision: 2 })
    expect(paused.status).toBe('recognized')
  })

  it('does not increment revision or invent a new assessment for repeated equivalent actions', () => {
    const assessed = applyVocabularyAction(legacy, { type: 'assess', level: 'recognized' }, now)
    expect(applyVocabularyAction(assessed, { type: 'assess', level: 'recognized' }, new Date('2026-10-06'))).toEqual(assessed)
    const enrolled = applyVocabularyAction(assessed, { type: 'enroll' }, now)
    expect(applyVocabularyAction(enrolled, { type: 'enroll' }, now)).toEqual(enrolled)
  })
})
