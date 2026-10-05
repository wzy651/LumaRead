import { describe, expect, it } from 'vitest'
import { selectLearningCandidates, sessionLookups } from './candidate-selection'
import type { LearningTerm, LookupRecord } from './types'
import type { LocalReadingSession } from './reading-sessions'

const now = new Date('2026-10-05T12:00:00.000Z')
const excerpt = { text: 'bank', sentence: 'She sat on the bank.', resourceKey: 'imported:one', bookTitle: 'One' }
const term: LearningTerm = { normalized: 'bank', text: 'bank', status: 'unknown', lookups: 999, lastSeen: now.toISOString(), example: excerpt }
function lookup(id: string, changes: Partial<LookupRecord> = {}): LookupRecord { return { ...excerpt, id, normalized: 'bank', createdAt: '2026-10-05T10:00:00.000Z', ...changes } }
function data(lookups = [lookup('a'), lookup('b')], terms = [term]) { return { lookups, terms, reviewCardKeys: [] as string[], reviews: [] as { normalized: string }[] } }
const session: LocalReadingSession = { id: 'session', resourceKey: 'imported:one', bookTitle: 'One', startedAt: '2026-10-05T09:00:00.000Z', updatedAt: '2026-10-05T11:00:00.000Z', endedAt: '2026-10-05T11:00:00.000Z', activeMs: 10000 }

describe('deterministic learning candidates', () => {
  it('never recommends a first lookup, whether common or rare, or fills empty slots', () => {
    expect(selectLearningCandidates(data([lookup('first')]), { now })).toEqual([])
    const rare = { ...term, normalized: 'sesquipedalian', text: 'sesquipedalian' }
    expect(selectLearningCandidates(data([lookup('rare', { normalized: rare.normalized, text: rare.text })], [rare]), { now })).toEqual([])
    expect(selectLearningCandidates(data([]), { now })).toEqual([])
    const singles = Array.from({ length: 18 }, (_, i) => ({ ...term, normalized: `single${i}`, text: `single${i}` }))
    expect(selectLearningCandidates(data(singles.map((item) => lookup(item.normalized, { normalized: item.normalized, text: item.text })), singles), { now })).toEqual([])
  })

  it('uses recent history instead of the lifetime counter and supplies honest reasons', () => {
    const [candidate] = selectLearningCandidates(data(), { now })
    expect(candidate).toMatchObject({ normalized: 'bank', text: 'bank', score: 4, lastLookupAt: '2026-10-05T10:00:00.000Z' })
    expect(candidate.reasons).toContain('近 30 天查询 2 次')
    expect(candidate.reasons.join(' ')).not.toContain('999')
    expect(candidate.reasons.join(' ')).not.toContain('遇见')
  })

  it('ranks repeated queries in different contexts above reopening one sentence', () => {
    const items = [lookup('a'), lookup('b', { sentence: 'The bank was closed.' }), lookup('c', { resourceKey: 'imported:two', sentence: 'A different bank.' })]
    const [candidate] = selectLearningCandidates(data(items), { now })
    expect(candidate.score).toBe(11)
    expect(candidate.reasons).toContain('在 3 个不同语境中查询过')
    expect(candidate.reasons).toContain('来自 2 本 / 篇内容')
    const [reopened] = selectLearningCandidates(data(Array.from({ length: 100 }, (_, i) => lookup(`repeat${i}`))), { now })
    expect(reopened.score).toBe(8)
    expect(reopened.reasons.some((reason) => reason.includes('不同语境'))).toBe(false)
  })

  it('normalizes sentence whitespace without counting block IDs as contexts', () => {
    const [candidate] = selectLearningCandidates(data([lookup('a'), lookup('b', { sentence: ' She  sat on the bank. ', blockId: 'different' })]), { now })
    expect(candidate.score).toBe(4)
  })

  it('prefers recency then the latest lookup for equally repeated expressions', () => {
    const terms = ['alpha', 'beta', 'gamma'].map((text) => ({ ...term, normalized: text, text }))
    const history = [lookup('alpha1', { normalized: 'alpha', text: 'alpha', createdAt: '2026-09-20T12:00:00.000Z' }), lookup('alpha2', { normalized: 'alpha', text: 'alpha', createdAt: '2026-09-20T12:01:00.000Z' }), lookup('beta1', { normalized: 'beta', text: 'beta', createdAt: '2026-10-05T11:00:00.000Z' }), lookup('beta2', { normalized: 'beta', text: 'beta', createdAt: '2026-10-05T11:01:00.000Z' }), lookup('gamma1', { normalized: 'gamma', text: 'gamma' }), lookup('gamma2', { normalized: 'gamma', text: 'gamma' })]
    const candidates = selectLearningCandidates(data(history, terms), { now })
    expect(candidates.map((item) => [item.normalized, item.score])).toEqual([['beta', 4], ['gamma', 4], ['alpha', 3]])
    expect(candidates[2].reasons.some((reason) => reason.includes('最近 7 天'))).toBe(false)
  })

  it.each(['learning', 'recognized', 'active'] as const)('excludes %s even before a card exists', (status) => {
    expect(selectLearningCandidates(data(undefined, [{ ...term, status }]), { now })).toEqual([])
  })

  it('excludes explicit removal, existing cards and old reviewed terms', () => {
    expect(selectLearningCandidates(data(undefined, [{ ...term, candidateExcluded: true }]), { now })).toEqual([])
    expect(selectLearningCandidates({ ...data(), reviewCardKeys: ['bank'] }, { now })).toEqual([])
    expect(selectLearningCandidates({ ...data(), reviews: [{ normalized: 'bank' }] }, { now })).toEqual([])
  })

  it('does not penalize old records lacking an exclusion field or mutate them when ignored', () => {
    const input = data(), before = structuredClone(input)
    expect(selectLearningCandidates(input, { now })).toHaveLength(1)
    expect(input).toEqual(before)
    expect(selectLearningCandidates(input, { now })).toHaveLength(1)
  })

  it('ignores invalid, future and older-than-30-day lookups', () => {
    const input = data([lookup('recent'), lookup('old', { createdAt: '2026-09-05T11:59:59.999Z' }), lookup('invalid', { createdAt: 'invalid' }), lookup('future', { createdAt: '2026-10-05T12:00:00.001Z' })])
    expect(selectLearningCandidates(input, { now })).toEqual([])
    expect(selectLearningCandidates(data([lookup('edge', { createdAt: '2026-09-05T12:00:00.000Z' }), lookup('recent')]), { now })).toHaveLength(1)
  })

  it('does not invent context or crash on damaged candidate records', () => {
    const input = data([lookup('a', { sentence: '' }), lookup('b', { sentence: '' }), null as unknown as LookupRecord])
    input.terms.push({ normalized: 'damaged' } as LearningTerm)
    const [candidate] = selectLearningCandidates(input, { now })
    expect(candidate.score).toBe(3)
    expect(candidate.reasons.some((reason) => reason.includes('语境'))).toBe(false)
  })

  it.each(['', ' ', 'x'.repeat(81), 'one two three four five six seven'])('does not recommend an empty or oversized expression: %s', (text) => {
    expect(selectLearningCandidates(data(undefined, [{ ...term, text }]), { now })).toEqual([])
  })

  it('caps a large session at five and orders ties independently of input order', () => {
    const terms = Array.from({ length: 50 }, (_, i) => ({ ...term, normalized: `term${String(i).padStart(2, '0')}`, text: `term${String(i).padStart(2, '0')}` }))
    const lookups = terms.flatMap((item) => [lookup(`${item.normalized}:a`, { normalized: item.normalized, text: item.text }), lookup(`${item.normalized}:b`, { normalized: item.normalized, text: item.text })])
    const expected = ['term00', 'term01', 'term02', 'term03', 'term04']
    expect(selectLearningCandidates(data(lookups, terms), { now }).map((item) => item.normalized)).toEqual(expected)
    expect(selectLearningCandidates(data([...lookups].reverse(), [...terms].reverse()), { now }).map((item) => item.normalized)).toEqual(expected)
  })

  it('keeps different surface forms separate instead of merging existing vocabulary identities', () => {
    const terms = ['go', 'went'].map((text) => ({ ...term, text, normalized: text }))
    const lookups = terms.flatMap((item) => [lookup(`${item.text}:a`, { text: item.text, normalized: item.text }), lookup(`${item.text}:b`, { text: item.text, normalized: item.text })])
    expect(selectLearningCandidates(data(lookups, terms), { now }).map((item) => item.normalized)).toEqual(['go', 'went'])
  })
})

describe('inferred session candidates', () => {
  it('restricts expressions and displayed context to the session while using recent history for scoring', () => {
    const otherTerm = { ...term, normalized: 'river', text: 'river' }
    const input = data([lookup('session'), lookup('after', { resourceKey: 'imported:two', sentence: 'A bank after this session.', createdAt: '2026-10-05T11:30:00.000Z' }), lookup('river1', { normalized: 'river', text: 'river', resourceKey: 'imported:two' }), lookup('river2', { normalized: 'river', text: 'river', resourceKey: 'imported:two' })], [term, otherTerm])
    const candidates = selectLearningCandidates(input, { now, session })
    expect(candidates).toHaveLength(1)
    expect(candidates[0].normalized).toBe('bank')
    expect(candidates[0].excerpt.sentence).toBe('She sat on the bank.')
    expect(candidates[0].excerpt.resourceKey).toBe('imported:one')
    expect(candidates[0].reasons).toContain('近 30 天查询 2 次')
  })

  it('includes exact session boundaries but not another book or unfinished/invalid sessions', () => {
    const lookups = [lookup('start', { createdAt: session.startedAt }), lookup('end', { createdAt: session.endedAt }), lookup('before', { createdAt: '2026-10-05T08:59:59.999Z' }), lookup('after', { createdAt: '2026-10-05T11:00:00.001Z' }), lookup('other', { resourceKey: 'imported:two' })]
    expect(sessionLookups(lookups, session).map((item) => item.id)).toEqual(['start', 'end'])
    expect(selectLearningCandidates(data(), { now, session: { ...session, endedAt: undefined } })).toEqual([])
    expect(sessionLookups(lookups, { ...session, endedAt: 'invalid' })).toEqual([])
    expect(selectLearningCandidates(data(), { now: new Date('invalid') })).toEqual([])
  })
})
