import { BookOpen, House, ListChecks, Timer } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { ThemeProvider } from './providers/ThemeProvider'
import { AppRoutes } from './routes/AppRoutes'
import { ThemeToggle } from '../components/ui'
import './app.css'

const navItems = [
  { to: '/', label: 'Home', icon: House },
  { to: '/reader/pride-and-prejudice', label: 'Reader', icon: BookOpen },
  { to: '/review', label: 'Review', icon: ListChecks },
  { to: '/session-summary', label: 'Summary', icon: Timer },
]

export function App() {
  return <ThemeProvider><div className="app-shell"><header className="app-header"><NavLink className="app-brand" to="/">LumaRead</NavLink><nav aria-label="Main navigation">{navItems.map(({ to, label, icon: Icon }) => <NavLink className={({ isActive }) => `app-nav-link${isActive ? ' app-nav-link--active' : ''}`} key={to} to={to}><Icon aria-hidden="true" size={18} /><span>{label}</span></NavLink>)}</nav><ThemeToggle /></header><AppRoutes /></div></ThemeProvider>
}
