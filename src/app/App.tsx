import { AuthProvider } from '@/app/providers/AuthProvider'
import { AppRouter } from '@/app/router'
import { BrowserRouter } from 'react-router-dom'

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRouter />
      </BrowserRouter>
    </AuthProvider>
  )
}
