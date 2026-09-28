import { learningTransaction } from './repository'

export interface LocalReadingSession { id: string; resourceKey: string; bookTitle: string; startedAt: string; updatedAt: string; activeMs: number; endedAt?: string }
const preference = 'lumaread-reading-time:v1'
export function readingTimeEnabled() { try { return localStorage.getItem(preference) !== 'off' } catch { return true } }
export function setReadingTimeEnabled(enabled: boolean) { try { localStorage.setItem(preference, enabled ? 'on' : 'off') } catch { /* The current session still changes. */ } window.dispatchEvent(new CustomEvent('reading-time-preference', { detail: enabled })) }

// Pure clock, also used by lifecycle tests. Long OS sleep gaps cannot count as reading.
export class ActiveReadingClock {
  activeMs = 0
  private last: number
  private interaction: number
  private foreground: boolean
  constructor(now: number, foreground: boolean) { this.last = now; this.interaction = now; this.foreground = foreground }
  tick(now: number) {
    const delta = now - this.last
    if (this.foreground && delta >= 0 && delta <= 15_000) this.activeMs += Math.max(0, Math.min(now, this.interaction + 120_000) - this.last)
    this.last = now
  }
  interact(now: number) { this.tick(now); this.interaction = now }
  focus(now: number, active: boolean) { this.tick(now); this.foreground = active; if (active) this.interaction = now }
}

let pending: Promise<unknown> = Promise.resolve()
export function saveReadingSession(session: LocalReadingSession) {
  if (session.activeMs < 1000) return Promise.resolve()
  const snapshot = { ...session }
  const save = learningTransaction<void>(['sessions'], 'readwrite', (tx, finish) => {
    const store = tx.objectStore('sessions'), request = store.get(snapshot.id)
    request.onsuccess = () => {
      const previous = request.result as LocalReadingSession | undefined
      store.put({ ...snapshot, activeMs: Math.max(previous?.activeMs ?? 0, snapshot.activeMs), endedAt: snapshot.endedAt ?? previous?.endedAt })
      finish(undefined)
    }
  })
  pending = Promise.allSettled([pending, save])
  return save
}
export async function waitForSessionWrites() { await pending }
