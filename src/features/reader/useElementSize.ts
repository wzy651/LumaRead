import { useLayoutEffect, useState, type RefObject } from 'react'

export type ElementSize = { width: number; height: number }

/** SSR-safe content-box measurement. The observer is owned by the caller's element only. */
export function useElementSize<T extends HTMLElement>(ref: RefObject<T | null>): ElementSize {
  const [size, setSize] = useState<ElementSize>({ width: 0, height: 0 })

  useLayoutEffect(() => {
    if (typeof window === 'undefined') return
    const element = ref.current
    if (!element) return
    const update = (next: ElementSize) => {
      const width = Math.max(0, Math.round(next.width))
      const height = Math.max(0, Math.round(next.height))
      setSize((current) => current.width === width && current.height === height ? current : { width, height })
    }
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(([entry]) => {
      if (entry) update({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    if (observer) {
      observer.observe(element)
    } else {
      const rect = element.getBoundingClientRect()
      update({ width: rect.width, height: rect.height })
    }
    const rect = element.getBoundingClientRect()
    update({ width: rect.width, height: rect.height })
    return () => observer?.disconnect()
  }, [ref])

  return size
}
