import { describe, expect, it } from 'vitest'
import { hasReliableProgress } from './home-progress'
describe('continue reading progress', () => { it('does not treat a missing percentage as zero progress', () => { expect(hasReliableProgress({})).toBe(false); expect(hasReliableProgress({ progressPercent: 0 })).toBe(true) }) })
