import { lazy, Suspense, useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from '@/app/providers/auth-context'
import { type MemberStatus } from '@/shared/lib/api'
import { navigate } from '@/shared/lib/navigation'

const AboutPage = lazy(() => import('@/pages/about').then((m) => ({ default: m.AboutPage })))
const LandingPage = lazy(() => import('@/pages/landing').then((m) => ({ default: m.LandingPage })))
const TermsPage = lazy(() => import('@/pages/terms').then((m) => ({ default: m.TermsPage })))
const PreferencesPage = lazy(() => import('@/pages/preferences').then((m) => ({ default: m.PreferencesPage })))
const MainTempPage = lazy(() => import('@/pages/main-temp').then((m) => ({ default: m.MainTempPage })))
const MainPage = lazy(() => import('@/pages/main').then((m) => ({ default: m.MainPage })))
const MyPage = lazy(() => import('@/pages/mypage').then((m) => ({ default: m.MyPage })))
const BlockedPage = lazy(() => import('@/pages/blocked').then((m) => ({ default: m.BlockedPage })))
const EventPage = lazy(() => import('@/pages/event').then((m) => ({ default: m.EventPage })))
const RankingPage = lazy(() => import('@/pages/ranking').then((m) => ({ default: m.RankingPage })))
const NotificationPage = lazy(() => import('@/pages/notification').then((m) => ({ default: m.NotificationPage })))
const MeetingDetailPage = lazy(() => import('@/pages/meeting-detail').then((m) => ({ default: m.MeetingDetailPage })))
const MeetingChatPage = lazy(() => import('@/pages/meeting-chat').then((m) => ({ default: m.MeetingChatPage })))
const MeetingCreatedPage = lazy(() => import('@/pages/meeting-created').then((m) => ({ default: m.MeetingCreatedPage })))
const MeetingCreatePage = lazy(() => import('@/pages/meeting-create').then((m) => ({ default: m.MeetingCreatePage })))
const MeetingJoinPage = lazy(() => import('@/pages/meeting-join').then((m) => ({ default: m.MeetingJoinPage })))
const MeetingEditPage = lazy(() => import('@/pages/meeting-edit').then((m) => ({ default: m.MeetingEditPage })))
const MeetingFinalPage = lazy(() => import('@/pages/meeting-final').then((m) => ({ default: m.MeetingFinalPage })))
const VoteCreatePage = lazy(() => import('@/pages/vote-create').then((m) => ({ default: m.VoteCreatePage })))
const VotePage = lazy(() => import('@/pages/vote').then((m) => ({ default: m.VotePage })))
const VoteTop3Page = lazy(() => import('@/pages/vote-top3').then((m) => ({ default: m.VoteTop3Page })))
const VoteWaitPage = lazy(() => import('@/pages/vote-wait').then((m) => ({ default: m.VoteWaitPage })))
const SettlementReceiptUploadPage = lazy(() => import('@/pages/settlement-receipt-upload').then((m) => ({ default: m.SettlementReceiptUploadPage })))
const SettlementOcrLoadingPage = lazy(() => import('@/pages/settlement-ocr-loading').then((m) => ({ default: m.SettlementOcrLoadingPage })))
const SettlementOcrFailedPage = lazy(() => import('@/pages/settlement-ocr-failed').then((m) => ({ default: m.SettlementOcrFailedPage })))
const SettlementOcrEditPage = lazy(() => import('@/pages/settlement-ocr-edit').then((m) => ({ default: m.SettlementOcrEditPage })))
const SettlementMenuSelectionPage = lazy(() => import('@/pages/settlement-menu-selection').then((m) => ({ default: m.SettlementMenuSelectionPage })))
const SettlementWaitingPage = lazy(() => import('@/pages/settlement-waiting').then((m) => ({ default: m.SettlementWaitingPage })))
const SettlementResultPage = lazy(() => import('@/pages/settlement-result').then((m) => ({ default: m.SettlementResultPage })))
const SettlementCompletedPage = lazy(() => import('@/pages/settlement-completed').then((m) => ({ default: m.SettlementCompletedPage })))
const ReviewCreatePage = lazy(() => import('@/pages/review-create').then((m) => ({ default: m.ReviewCreatePage })))
const ReviewDetailPage = lazy(() => import('@/pages/review-detail').then((m) => ({ default: m.ReviewDetailPage })))
const QuickEnterPage = lazy(() => import('@/pages/quick-enter').then((m) => ({ default: m.QuickEnterPage })))
const QuickRoomPage = lazy(() => import('@/pages/quick-room').then((m) => ({ default: m.QuickRoomPage })))
const QuickVotePage = lazy(() => import('@/pages/quick-vote').then((m) => ({ default: m.QuickVotePage })))
const QuickResultPage = lazy(() => import('@/pages/quick-result').then((m) => ({ default: m.QuickResultPage })))

const statusRoute: Record<MemberStatus, string> = {
  PENDING: '/terms',
  ONBOARDING: '/preferences',
  ACTIVE: '/main',
  DELETED: '/blocked',
}

const publicPaths = new Set(['/', '/terms', '/preferences', '/meetings/join', '/about'])
const publicPathPrefixes = ['/quick']

function isPublicPath(pathname: string) {
  if (publicPaths.has(pathname)) return true
  return publicPathPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

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
      if (!isPublicPath(pathname)) {
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
      if (status !== 'ACTIVE' && pathname !== allowed) {
        return
      }
    }
  }, [loading, member, pathname, status])

  useEffect(() => {
    if (loading) return
    if (!member) return
    if (status && status !== 'ACTIVE') return
    const redirectPath = sessionStorage.getItem('postLoginRedirect')
    if (!redirectPath) return
    sessionStorage.removeItem('postLoginRedirect')
    if (redirectPath === pathname) return
    navigate(redirectPath, { replace: true })
  }, [loading, member, pathname, status])

  if (pathname === '/about') {
    return (
      <Suspense fallback={null}>
        <AboutPage />
      </Suspense>
    )
  }

  if (loading) return <LoadingScreen />

  if (!member && !isPublicPath(pathname)) {
    return <Navigate to="/" replace />
  }

  if (status === 'DELETED' && pathname !== '/blocked') {
    return <Navigate to="/blocked" replace />
  }

  if (status === 'ACTIVE' && pathname === '/') {
    return <Navigate to="/main" replace />
  }

  if (status && status !== 'ACTIVE' && pathname !== statusRoute[status]) {
    return <Navigate to={statusRoute[status]} replace />
  }

  return (
    <Suspense fallback={<LoadingScreen />}>
    <Routes>
      <Route path="/about" element={<AboutPage />} />
      <Route path="/" element={<LandingPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/preferences" element={<PreferencesPage />} />
      <Route path="/main" element={<MainPage />} />
      <Route path="/main-temp" element={<MainTempPage />} />
      <Route path="/quick" element={<QuickEnterPage />} />
      <Route path="/quick/:inviteCode" element={<QuickRoomPage />} />
      <Route path="/quick/:inviteCode/vote" element={<QuickVotePage />} />
      <Route path="/quick/:inviteCode/result" element={<QuickResultPage />} />
      <Route path="/event" element={<EventPage />} />
      <Route path="/ranking" element={<RankingPage />} />
      <Route path="/notification" element={<NotificationPage />} />
      <Route path="/mypage" element={<MyPage />} />
      <Route path="/blocked" element={<BlockedPage />} />
      <Route path="/meetings/new" element={<MeetingCreatePage />} />
      <Route path="/meetings/join" element={<MeetingJoinPage />} />
      <Route path="/meetings/:meetingId/edit" element={<MeetingEditPage />} />
      <Route path="/meetings/:meetingId" element={<MeetingDetailPage />} />
      <Route path="/meetings/:meetingId/chat" element={<MeetingChatPage />} />
      <Route path="/meetings/:meetingId/created" element={<MeetingCreatedPage />} />
      <Route path="/meetings/:meetingId/final" element={<MeetingFinalPage />} />
      <Route path="/meetings/:meetingId/reviews" element={<ReviewCreatePage />} />
      <Route path="/votes/new" element={<VoteCreatePage />} />
      <Route path="/reviews/:reviewId" element={<ReviewDetailPage />} />
      <Route path="/meetings/:meetingId/votes/:voteId" element={<VotePage />} />
      <Route path="/meetings/:meetingId/votes/:voteId/wait" element={<VoteWaitPage />} />
      <Route path="/meetings/:meetingId/votes/:voteId/top3" element={<VoteTop3Page />} />
      <Route
        path="/meetings/:meetingId/settlement/receipt"
        element={<SettlementReceiptUploadPage />}
      />
      <Route
        path="/meetings/:meetingId/settlement/ocr/loading"
        element={<SettlementOcrLoadingPage />}
      />
      <Route
        path="/meetings/:meetingId/settlement/ocr/failed"
        element={<SettlementOcrFailedPage />}
      />
      <Route
        path="/meetings/:meetingId/settlement/ocr/edit"
        element={<SettlementOcrEditPage />}
      />
      <Route
        path="/meetings/:meetingId/settlement/selection"
        element={<SettlementMenuSelectionPage />}
      />
      <Route path="/meetings/:meetingId/settlement/wait" element={<SettlementWaitingPage />} />
      <Route path="/meetings/:meetingId/settlement/result" element={<SettlementResultPage />} />
      <Route
        path="/meetings/:meetingId/settlement/completed"
        element={<SettlementCompletedPage />}
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
    </Suspense>
  )
}
