import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

function getPageTitle(pathname: string): string {
  if (pathname.startsWith('/reader/')) return 'Reading — LumaRead'
  if (pathname === '/review') return 'Quick Review — LumaRead'
  if (pathname === '/settings') return '阅读帮助设置 — LumaRead'
  if (pathname === '/statistics') return '阅读足迹 — LumaRead'
  if (pathname === '/session-summary') return 'Reading Saved — LumaRead'
  return 'LumaRead'
}

export function RouteEffects() {
  const { pathname } = useLocation()
  const previousPathname = useRef(pathname)

  useEffect(() => {
    document.title = getPageTitle(pathname)

    const didNavigate = previousPathname.current !== pathname
    previousPathname.current = pathname
    if (!didNavigate) return

    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })

    const frame = window.requestAnimationFrame(() => {
      const heading = document.querySelector<HTMLElement>('main h1')
      if (!heading) return

      const existingTabIndex = heading.getAttribute('tabindex')
      heading.tabIndex = -1
      heading.focus({ preventScroll: true })
      heading.addEventListener('blur', () => {
        if (existingTabIndex === null) heading.removeAttribute('tabindex')
        else heading.setAttribute('tabindex', existingTabIndex)
      }, { once: true })
    })

    return () => window.cancelAnimationFrame(frame)
  }, [pathname])

  return null
}
