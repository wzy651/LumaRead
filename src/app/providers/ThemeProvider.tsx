import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { ThemeContext, type Theme } from './theme-context'

const storageKey = 'lumaread-theme'

function getInitialTheme(): Theme {
  const storedTheme = localStorage.getItem(storageKey)
  if (storedTheme === 'light' || storedTheme === 'dark') return storedTheme
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(getInitialTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#161719' : '#F7F7F5')
    localStorage.setItem(storageKey, theme)
  }, [theme])

  const toggleTheme = useCallback(() => setTheme((currentTheme) => currentTheme === 'light' ? 'dark' : 'light'), [])
  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>
}
