import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from '@/app/providers/auth-context'
import { type MemberStatus } from '@/shared/lib/api'
import { LandingPage } from '@/pages/landing'
import { TermsPage } from '@/pages/terms'
import { PreferencesPage } from '@/pages/preferences'
import { MainTempPage } from '@/pages/main-temp'
import { MainPage } from '@/pages/main'
import { MyPage } from '@/pages/mypage'
import { BlockedPage } from '@/pages/blocked'
import { EventPage } from '@/pages/event'
import { RankingPage } from '@/pages/ranking'
import { NotificationPage } from '@/pages/notification'
import { MeetingDetailPage } from '@/pages/meeting-detail'
import { MeetingCreatedPage } from '@/pages/meeting-created'
import { MeetingCreatePage } from '@/pages/meeting-create'
import { MeetingEditPage } from '@/pages/meeting-edit'
import { MeetingFinalPage } from '@/pages/meeting-final'
import { VoteCreatePage } from '@/pages/vote-create'
import { VotePage } from '@/pages/vote'
import { VoteTop3Page } from '@/pages/vote-top3'
import { VoteWaitPage } from '@/pages/vote-wait'

const statusRoute: Record<MemberStatus, string> = {
  PENDING: '/terms',
  ONBOARDING: '/preferences',
  ACTIVE: '/main',
  DELETED: '/blocked',
}

const publicPaths = new Set(['/', '/terms', '/preferences'])
const tempPaths = new Set([
  '/main',
  '/main-temp',
  '/event',
  '/ranking',
  '/notification',
  '/mypage',
  '/blocked',
  '/meetings/new',
  '/meetings/:meetingId/edit',
  '/meetings/:meetingId',
  '/meetings/:meetingId/created',
  '/meetings/:meetingId/final',
  '/votes/new',
  '/meetings/:meetingId/votes/:voteId',
  '/meetings/:meetingId/votes/:voteId/wait',
  '/meetings/:meetingId/votes/:voteId/top3',
])

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
  const { pathname } = useLocation()

  useEffect(() => {
    if (loading) return

    if (!member) {
      if (!publicPaths.has(pathname)) {
        return
      }
      return
    }

    if (status === 'DELETED') {
      if (pathname !== '/blocked') return
      return
    }

    if (status) {
      const allowed = statusRoute[status]
      if (status === 'ACTIVE' && tempPaths.has(pathname)) {
        return
      }
      if (pathname !== allowed) {
        return
      }
    }
  }, [loading, member, pathname, status])

  if (loading) return <LoadingScreen />

  if (!member && !publicPaths.has(pathname)) {
    return <Navigate to="/" replace />
  }

  if (status === 'DELETED' && pathname !== '/blocked') {
    return <Navigate to="/blocked" replace />
  }

  if (status && pathname !== statusRoute[status]) {
    if (!(status === 'ACTIVE' && tempPaths.has(pathname))) {
      return <Navigate to={statusRoute[status]} replace />
    }
  }

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/preferences" element={<PreferencesPage />} />
      <Route path="/main" element={<MainPage />} />
      <Route path="/main-temp" element={<MainTempPage />} />
      <Route path="/event" element={<EventPage />} />
      <Route path="/ranking" element={<RankingPage />} />
      <Route path="/notification" element={<NotificationPage />} />
      <Route path="/mypage" element={<MyPage />} />
      <Route path="/blocked" element={<BlockedPage />} />
      <Route path="/meetings/new" element={<MeetingCreatePage />} />
      <Route path="/meetings/:meetingId/edit" element={<MeetingEditPage />} />
      <Route path="/meetings/:meetingId" element={<MeetingDetailPage />} />
      <Route path="/meetings/:meetingId/created" element={<MeetingCreatedPage />} />
      <Route path="/meetings/:meetingId/final" element={<MeetingFinalPage />} />
      <Route path="/votes/new" element={<VoteCreatePage />} />
      <Route path="/meetings/:meetingId/votes/:voteId" element={<VotePage />} />
      <Route path="/meetings/:meetingId/votes/:voteId/wait" element={<VoteWaitPage />} />
      <Route path="/meetings/:meetingId/votes/:voteId/top3" element={<VoteTop3Page />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
