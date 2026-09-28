import { ThemeProvider } from './providers/ThemeProvider'
import { AppRoutes } from './routes/AppRoutes'
import { AndroidNavigation } from '../platform/AndroidNavigation'

export function App() {
  return <ThemeProvider><AndroidNavigation /><AppRoutes /></ThemeProvider>
}
