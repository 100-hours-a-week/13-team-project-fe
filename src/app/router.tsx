import { useEffect, useMemo } from 'react'
import { useAuth } from '@/app/providers/AuthProvider'
import { navigate, usePathname } from '@/shared/lib/navigation'
import { type MemberStatus } from '@/shared/lib/api'
import { LandingPage } from '@/pages/landing'
import { TermsPage } from '@/pages/terms'
import { PreferencesPage } from '@/pages/preferences'
import { MainTempPage } from '@/pages/main-temp'
import { MyPage } from '@/pages/mypage'
import { BlockedPage } from '@/pages/blocked'

const statusRoute: Record<MemberStatus, string> = {
  PENDING: '/terms',
  ONBOARDING: '/preferences',
  ACTIVE: '/main-temp',
  DELETED: '/blocked',
}

const routeMap: Record<string, JSX.Element> = {
  '/': <LandingPage />,
  '/terms': <TermsPage />,
  '/preferences': <PreferencesPage />,
  '/main': <MainTempPage />,
  '/main-temp': <MainTempPage />,
  '/mypage': <MyPage />,
  '/blocked': <BlockedPage />,
}

const publicPaths = new Set(['/', '/terms', '/preferences'])
const tempPaths = new Set(['/main', '/main-temp', '/mypage'])

function LoadingScreen() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg)',
        color: 'var(--muted)',
        fontSize: '15px',
      }}
    >
      로그인 상태를 확인하고 있어요...
    </div>
  )
}

function NotFound() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg)',
      }}
    >
      요청하신 페이지를 찾을 수 없어요.
    </div>
  )
}

export function AppRouter() {
  const { member, status, loading } = useAuth()
  const pathname = usePathname()

  useEffect(() => {
    if (loading) return

    if (!member) {
      if (!publicPaths.has(pathname)) {
        navigate('/', { replace: true })
      }
      return
    }

    if (status === 'DELETED') {
      if (pathname !== '/blocked') {
        navigate('/blocked', { replace: true })
      }
      return
    }

    if (status) {
      const allowed = statusRoute[status]
      if (status === 'ACTIVE' && tempPaths.has(pathname)) {
        return
      }
      if (pathname !== allowed) {
        navigate(allowed, { replace: true })
      }
    }
  }, [loading, member, pathname, status])

  const element = useMemo(() => routeMap[pathname] ?? <NotFound />, [pathname])

  if (loading) return <LoadingScreen />

  return element
}
