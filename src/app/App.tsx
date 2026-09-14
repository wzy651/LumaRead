import { ThemeProvider } from './providers/ThemeProvider'
import { AppRoutes } from './routes/AppRoutes'

export function App() {
  return <ThemeProvider><AppRoutes /></ThemeProvider>
}
