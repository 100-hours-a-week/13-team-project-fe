import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import styles from './QuickRoomPage.module.css'
import { ApiError, initCsrfToken } from '@/shared/lib/api'
import {
  enterQuickMeeting,
  getQuickMeetingDetail,
  regenerateQuickVote,
  type QuickVoteStatus,
  type QuickMeetingDetailResponse,
} from '@/entities/quick-meeting'
import { useAuth } from '@/app/providers/auth-context'
import {
  getQuickGuestUuid,
  removeQuickGuestUuid,
  saveQuickGuestUuid,
  saveQuickSession,
  type QuickSession,
} from '@/shared/lib/quick-session'
import { navigate } from '@/shared/lib/navigation'

function formatLeftTime(deadline: string) {
  const remainMs = new Date(deadline).getTime() - Date.now()
  if (!Number.isFinite(remainMs) || remainMs <= 0) return '마감됨'
  const totalSec = Math.floor(remainMs / 1000)
  const min = String(Math.floor(totalSec / 60)).padStart(2, '0')
  const sec = String(totalSec % 60).padStart(2, '0')
  return `${min}:${sec}`
}

const statusLabel: Record<QuickVoteStatus, string> = {
  GENERATING: '준비 중',
  RESERVED: '준비 중',
  OPEN: '투표 가능',
  COUNTING: '결과 집계 중',
  COUNTED: '결과',
  FAILED: '준비 중',
  CLOSED: '준비 중',
  UNKNOWN: '준비 중',
}

function toDetailSession(data: QuickMeetingDetailResponse): QuickSession {
  return {
    meetingId: data.meetingId,
    inviteCode: data.inviteCode,
    locationAddress: data.locationAddress,
    participantCount: data.participantCount,
    targetHeadcount: data.targetHeadcount,
    voteDeadlineAt: data.voteDeadlineAt,
    currentVoteId: data.currentVoteId,
    voteStatus: data.voteStatus,
    hostMemberId: data.hostMemberId ?? null,
  }
}

function normalizeInviteCode(value: string | undefined) {
  return (value ?? '').trim().toUpperCase()
}

function getEnterErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 404) return '초대코드가 올바르지 않아요.'
    if (error.status === 409) return '정원이 가득 찼거나 입장할 수 없는 모임이에요.'
    if (error.status === 403) return '잘못된 접근입니다. 다시 입장해 주세요.'
    if (error.status === 400) return '입장 정보가 올바르지 않아요. 다시 시도해 주세요.'
  }
  return error instanceof Error ? error.message : '퀵모임 정보를 불러오지 못했어요.'
}

export function QuickRoomPage() {
  const { member } = useAuth()
  const { inviteCode: inviteCodeParam } = useParams()
  const inviteCode = normalizeInviteCode(inviteCodeParam)
  const [session, setSession] = useState<QuickSession | null>(null)
  const [leftTime, setLeftTime] = useState('')
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const enterMeeting = useCallback(async () => {
    const storedGuestUuid = getQuickGuestUuid(inviteCode)
    try {
      await initCsrfToken()
      const response = await enterQuickMeeting({
        inviteCode,
        ...(storedGuestUuid ? { guestUuid: storedGuestUuid } : {}),
      })
      if (response.guestUuid) {
        saveQuickGuestUuid(inviteCode, response.guestUuid)
      }
      return true
    } catch (err) {
      if (err instanceof ApiError && err.status === 400 && storedGuestUuid) {
        removeQuickGuestUuid(inviteCode)
        await initCsrfToken()
        const retry = await enterQuickMeeting({ inviteCode })
        if (retry.guestUuid) {
          saveQuickGuestUuid(inviteCode, retry.guestUuid)
        }
        return true
      }
      throw err
    }
  }, [inviteCode])

  const fetchSession = useCallback(async (showLoading = false, recovered = false) => {
    if (inviteCode.length !== 8) {
      setError('초대코드 형식이 올바르지 않아요.')
      setLoading(false)
      return null
    }

    try {
      if (showLoading) setLoading(true)
      setError(null)
      const response = await getQuickMeetingDetail(inviteCode)
      const next = toDetailSession(response)
      setSession(next)
      saveQuickSession(inviteCode, next)
      return next
    } catch (err) {
      if (!recovered && err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        try {
          await enterMeeting()
          return await fetchSession(showLoading, true)
        } catch (recoverErr) {
          const recoverMessage = getEnterErrorMessage(recoverErr)
          setError(recoverMessage)
          if (
            recoverErr instanceof ApiError &&
            (recoverErr.status === 403 || recoverErr.status === 404)
          ) {
            navigate('/quick', { replace: true })
          }
          return null
        }
      }
      setError(getEnterErrorMessage(err))
      return null
    } finally {
      if (showLoading) setLoading(false)
    }
  }, [enterMeeting, inviteCode])

  useEffect(() => {
    void fetchSession(true)
  }, [fetchSession])

  useEffect(() => {
    const timerId = window.setInterval(() => {
      void fetchSession(false)
    }, 2500)
    return () => window.clearInterval(timerId)
  }, [fetchSession])

  useEffect(() => {
    if (!session?.voteDeadlineAt) return
    const update = () => setLeftTime(formatLeftTime(session.voteDeadlineAt))
    update()
    const timerId = window.setInterval(update, 1000)
    return () => window.clearInterval(timerId)
  }, [session?.voteDeadlineAt])

  const canGoVote = useMemo(() => {
    return Boolean(session?.currentVoteId)
  }, [session?.currentVoteId])

  const isHost = useMemo(() => {
    if (!session?.hostMemberId || !member?.memberId) return false
    return session.hostMemberId === member.memberId
  }, [member?.memberId, session?.hostMemberId])

  const handleRegenerateVote = useCallback(async () => {
    if (!session || !session.currentVoteId || actionLoading) return
    try {
      setActionLoading(true)
      setError(null)
      await regenerateQuickVote(session.meetingId)
      await fetchSession(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : '투표 재생성에 실패했어요.')
    } finally {
      setActionLoading(false)
    }
  }, [actionLoading, fetchSession, session])

  const handleEnterVote = useCallback(() => {
    if (!session || actionLoading) return
    if (!session.currentVoteId) {
      setError('투표 준비중입니다. 잠시 후 다시 시도해 주세요.')
      return
    }
    setError(null)
    navigate(`/quick/${session.inviteCode}/vote`)
  }, [actionLoading, session])

  const buttonConfig = useMemo(() => {
    const status = session?.voteStatus ?? 'UNKNOWN'
    if (status === 'OPEN') {
      return {
        label: '투표 참여하기',
        disabled: !canGoVote || actionLoading,
        onClick: () => {
          handleEnterVote()
        },
      }
    }
    if (status === 'COUNTED') {
      return {
        label: '결과보기',
        disabled: !canGoVote || actionLoading,
        onClick: () => navigate(`/quick/${session?.inviteCode}/result`),
      }
    }
    if (status === 'FAILED' && isHost) {
      return {
        label: actionLoading ? '재생성 중...' : '투표 재생성 하기',
        disabled: !canGoVote || actionLoading,
        onClick: () => {
          void handleRegenerateVote()
        },
      }
    }
    if (status === 'COUNTING') {
      return {
        label: '결과 집계 중',
        disabled: true,
        onClick: () => undefined,
      }
    }
    return {
      label: '투표 준비중',
      disabled: true,
      onClick: () => undefined,
    }
  }, [
    actionLoading,
    canGoVote,
    handleEnterVote,
    handleRegenerateVote,
    isHost,
    session?.inviteCode,
    session?.voteStatus,
  ])

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button
          type="button"
          className={styles.backButton}
          onClick={() => navigate('/main')}
          aria-label="메인으로 돌아가기"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className={styles.title}>퀵 모임</h1>
      </header>

      {loading ? <p className={styles.note}>입장 정보를 확인하는 중...</p> : null}
      {error ? <p className={styles.error}>{error}</p> : null}

      {!loading && !error && session ? (
        <section className={styles.card}>
          <div className={styles.row}>
            <span>초대코드</span>
            <strong>{session.inviteCode}</strong>
          </div>
          <div className={styles.row}>
            <span>장소</span>
            <strong>{session.locationAddress}</strong>
          </div>
          <div className={styles.row}>
            <span>인원</span>
            <strong>
              {session.participantCount}/{session.targetHeadcount}
            </strong>
          </div>
          <div className={styles.row}>
            <span>마감까지</span>
            <strong>{leftTime || '확인 중...'}</strong>
          </div>
          <div className={styles.row}>
            <span>투표 상태</span>
            <strong className={styles.statusValue}>
              {statusLabel[session.voteStatus] ?? '준비 중'}
              {session.voteStatus !== 'OPEN' && session.voteStatus !== 'COUNTED' ? (
                <span className={styles.inlineSpinner} aria-hidden="true" />
              ) : null}
            </strong>
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={buttonConfig.onClick}
              disabled={buttonConfig.disabled}
            >
              {buttonConfig.disabled &&
              (buttonConfig.label === '투표 준비중' || buttonConfig.label === '결과 집계 중') ? (
                <span className={styles.buttonSpinner} aria-hidden="true" />
              ) : null}
              {buttonConfig.label}
            </button>
          </div>
        </section>
      ) : null}
    </div>
  )
}
