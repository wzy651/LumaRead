import { useLayoutEffect, useState } from 'react'
import type { LocatedExcerpt } from './selection'

// A transient paint layer, never a DOM wrapper or a persisted annotation.
// Range rectangles are clipped to the reading viewport, including EPUB Pages.
export function ActiveWordHighlight({ located }: { located?: LocatedExcerpt }) {
  const [rects, setRects] = useState<Array<{ left: number; top: number; width: number; height: number }>>([])
  useLayoutEffect(() => {
    if (!located?.range) return
    const range = located.range
    const clipElement = located.anchor.closest('.reader-article--pages, .pdf-reader__stage')
    let frame = 0
    const measure = () => {
      if (!located.anchor.isConnected) { setRects([]); return }
      const clip = clipElement?.getBoundingClientRect()
      setRects(Array.from(range.getClientRects()).flatMap((rect) => {
        const left = Math.max(rect.left, clip?.left ?? 0, 0)
        const top = Math.max(rect.top, clip?.top ?? 0, 0)
        const right = Math.min(rect.right, clip?.right ?? innerWidth, innerWidth)
        const bottom = Math.min(rect.bottom, clip?.bottom ?? innerHeight, innerHeight)
        return right > left && bottom > top ? [{ left, top, width: right - left, height: bottom - top }] : []
      }))
    }
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure) }
    const observer = new ResizeObserver(schedule); observer.observe(located.anchor)
    measure(); window.addEventListener('resize', schedule); window.addEventListener('scroll', schedule, true)
    return () => { cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener('resize', schedule); window.removeEventListener('scroll', schedule, true) }
  }, [located])
  if (!located?.range) return null
  return <div className="lookup-active-word" aria-hidden="true">{rects.map((rect, index) => <span key={index} style={rect} />)}</div>
}
