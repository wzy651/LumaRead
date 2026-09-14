import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../../app/providers/useTheme'
import { IconButton } from './IconButton'

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const nextLabel = theme === 'light' ? '切换到深色主题' : '切换到浅色主题'
  return <IconButton label={nextLabel} onClick={toggleTheme}>{theme === 'light' ? <Moon aria-hidden="true" size={20} /> : <Sun aria-hidden="true" size={20} />}</IconButton>
}
