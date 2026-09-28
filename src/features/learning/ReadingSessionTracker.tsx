import { useEffect } from 'react'
import { ActiveReadingClock, readingTimeEnabled, saveReadingSession, type LocalReadingSession } from './reading-sessions'

/** Mount once per rendered book, not once per section or PDF page. No UI or network. */
export function ReadingSessionTracker({ resourceKey, bookTitle }: { resourceKey: string; bookTitle: string }) {
  useEffect(() => {
    let enabled = readingTimeEnabled()
    let clock = new ActiveReadingClock(performance.now(), enabled && document.visibilityState === 'visible' && document.hasFocus())
    let session: LocalReadingSession = { id: crypto.randomUUID(), resourceKey, bookTitle, startedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), activeMs: 0 }
    const persist = (ended = false) => {
      clock.tick(performance.now())
      if (!enabled) return
      session = { ...session, activeMs: clock.activeMs, updatedAt: new Date().toISOString(), ...(ended ? { endedAt: new Date().toISOString() } : {}) }
      void saveReadingSession(session).catch(() => undefined)
    }
    const foreground = () => { clock.focus(performance.now(), enabled && document.visibilityState === 'visible' && document.hasFocus()); persist() }
    const interact = () => clock.interact(performance.now())
    const pagehide = () => { clock.focus(performance.now(), false); persist() }
    const preference = (event: Event) => {
      const next = (event as CustomEvent<boolean>).detail
      if (enabled === next) return
      persist(true); enabled = next
      clock = new ActiveReadingClock(performance.now(), enabled && document.visibilityState === 'visible' && document.hasFocus())
      session = { id: crypto.randomUUID(), resourceKey, bookTitle, startedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), activeMs: 0 }
    }
    const timer = window.setInterval(() => persist(), 10_000)
    window.addEventListener('focus', foreground); window.addEventListener('blur', foreground)
    document.addEventListener('visibilitychange', foreground); window.addEventListener('pagehide', pagehide)
    window.addEventListener('reading-time-preference', preference)
    for (const name of ['pointerdown', 'keydown', 'scroll', 'wheel', 'touchstart']) document.addEventListener(name, interact, { capture: true, passive: true })
    return () => {
      persist(true); clearInterval(timer)
      window.removeEventListener('focus', foreground); window.removeEventListener('blur', foreground)
      document.removeEventListener('visibilitychange', foreground); window.removeEventListener('pagehide', pagehide)
      window.removeEventListener('reading-time-preference', preference)
      for (const name of ['pointerdown', 'keydown', 'scroll', 'wheel', 'touchstart']) document.removeEventListener(name, interact, true)
    }
  }, [resourceKey, bookTitle])
  return null
}
