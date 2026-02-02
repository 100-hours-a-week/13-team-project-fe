import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import styles from './MeetingJoinPage.module.css'
import { participateMeeting } from '@/entities/meeting'
import { navigate } from '@/shared/lib/navigation'
import { useAuth } from '@/app/providers/auth-context'

type LoadState = 'idle' | 'loading' | 'success' | 'error'

export function MeetingJoinPage() {
  const { search } = useLocation()
  const { member, status: memberStatus, loading } = useAuth()
  const [status, setStatus] = useState<LoadState>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const [meetingId, setMeetingId] = useState<number | null>(null)

  const inviteCode = useMemo(() => {
    const params = new URLSearchParams(search)
    return params.get('code')?.trim() ?? ''
  }, [search])

  const goMain = useCallback(() => {
    navigate('/main')
  }, [])

  useEffect(() => {
    if (loading) return
    if (member) return
    const redirectPath = `${window.location.pathname}${window.location.search}`
    sessionStorage.setItem('postLoginRedirect', redirectPath)
    navigate('/', { replace: true })
  }, [loading, member])

  const handleJoin = useCallback(async () => {
    if (!member || (memberStatus && memberStatus !== 'ACTIVE')) return
    if (!inviteCode) {
      setStatus('error')
      setMessage('초대 코드가 필요합니다.')
      return
    }

    setStatus('loading')
    setMessage(null)

    try {
      const result = await participateMeeting(inviteCode)
      setMeetingId(result.meetingId)
      setStatus('success')
      navigate(`/meetings/${result.meetingId}`)
    } catch (error) {
      setStatus('error')
      setMessage(error instanceof Error ? error.message : '모임 참여에 실패했습니다.')
    }
  }, [inviteCode, member, memberStatus])

  useEffect(() => {
    if (loading) return
    if (!member || (memberStatus && memberStatus !== 'ACTIVE')) return
    const timerId = window.setTimeout(() => {
      void handleJoin()
    }, 0)
    return () => window.clearTimeout(timerId)
  }, [handleJoin, loading, member, memberStatus])

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button
          type="button"
          className={styles.backButton}
          onClick={goMain}
          aria-label="메인으로 돌아가기"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className={styles.title}>모임 참여</h1>
      </header>

      <section className={styles.card}>
        {status === 'loading' && (
          <>
            <p className={styles.stateTitle}>모임에 참여 중이에요.</p>
            <p className={styles.stateText}>잠시만 기다려주세요.</p>
          </>
        )}

        {status === 'error' && (
          <>
            <p className={styles.stateTitle}>모임 참여에 실패했어요.</p>
            <p className={`${styles.stateText} ${styles.errorText}`}>
              {message ?? '다시 시도해주세요.'}
            </p>
            <div className={styles.actions}>
              <button type="button" className={styles.primaryButton} onClick={handleJoin}>
                다시 시도하기
              </button>
              <button type="button" className={styles.secondaryButton} onClick={goMain}>
                메인으로 이동
              </button>
            </div>
          </>
        )}

        {status === 'success' && (
          <>
            <p className={styles.stateTitle}>모임 참여가 완료되었습니다.</p>
            <p className={styles.stateText}>모임 상세 페이지로 이동합니다.</p>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={() =>
                  navigate(meetingId ? `/meetings/${meetingId}` : '/main')
                }
              >
                모임 상세로 이동
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
