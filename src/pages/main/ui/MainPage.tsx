import { useEffect, useState } from 'react'
import styles from './MainPage.module.css'
import { getMyMeetings, participateMeeting } from '@/entities/meeting'
import { logout } from '@/shared/lib/api'
import { useAuth } from '@/app/providers/auth-context'
import { navigate } from '@/shared/lib/navigation'
import { HeaderLogo } from '@/shared/ui/header-logo'
import { BottomNav } from '@/shared/ui/bottom-nav'

type LoadState = 'idle' | 'loading' | 'success' | 'error'

function formatDateTime(value: string) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const parts = new Intl.DateTimeFormat('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(date)
  const dayPeriod = parts.find((part) => part.type === 'dayPeriod')?.value ?? ''
  const hour = parts.find((part) => part.type === 'hour')?.value ?? ''
  const minute = parts.find((part) => part.type === 'minute')?.value ?? ''
  return `약속 시간: ${month}.${day}. ${dayPeriod} ${hour}:${minute}`
}

export function MainPage() {
  const { setMember } = useAuth()
  const [joinModalOpen, setJoinModalOpen] = useState(false)
  const [inviteCode, setInviteCode] = useState('')
  const [joinState, setJoinState] = useState<LoadState>('idle')
  const [joinError, setJoinError] = useState<string | null>(null)

  const [meetingsState, setMeetingsState] = useState<LoadState>('idle')
  const [meetingsError, setMeetingsError] = useState<string | null>(null)
  const [meetings, setMeetings] = useState<
    Awaited<ReturnType<typeof getMyMeetings>>['items']
  >([])

  useEffect(() => {
    let active = true
    const loadMeetings = async () => {
      setMeetingsState('loading')
      setMeetingsError(null)
      try {
        const data = await getMyMeetings()
        if (!active) return
        setMeetings(data.items ?? [])
        setMeetingsState('success')
      } catch (error) {
        if (!active) return
        const message =
          error instanceof Error ? error.message : '모임 목록을 불러오지 못했어요.'
        setMeetingsError(message)
        setMeetingsState('error')
      }
    }
    loadMeetings()
    return () => {
      active = false
    }
  }, [])

  const handleJoinOpen = () => {
    setInviteCode('')
    setJoinError(null)
    setJoinState('idle')
    setJoinModalOpen(true)
  }

  const handleJoinClose = () => {
    if (joinState === 'loading') return
    setJoinModalOpen(false)
  }

  const handleJoinConfirm = async () => {
    if (!inviteCode.trim()) {
      setJoinError('초대 코드를 입력해주세요.')
      return
    }
    setJoinState('loading')
    setJoinError(null)
    try {
      const result = await participateMeeting(inviteCode.trim())
      navigate(`/meetings/${result.meetingId}`)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '모임 참여에 실패했어요.'
      setJoinError(message)
      setJoinState('error')
    }
  }

  const handleLogout = async () => {
    try {
      await logout()
    } finally {
      setMember(null)
      navigate('/')
    }
  }

  const meetingStatusLabel = (status: string | null | undefined) => {
    if (status === 'READY') return '투표 준비 중'
    if (status === 'VOTING') return '투표 중'
    if (status === 'DONE') return '완료'
    return '투표 준비중'
  }

  return (
    <div className={styles.page}>
      <div className={styles.content}>
        <header className={styles.header}>
          <div className={styles.brand}>
            <HeaderLogo className={styles.brandTitle} label="모여밥" />
          </div>
          <button type="button" className={styles.logout} onClick={handleLogout}>
            로그아웃
          </button>
        </header>

        <main className={styles.main}>
          <section className={styles.actionSection}>
            <button
              type="button"
              className={styles.actionCard}
              onClick={() => navigate('/meetings/new')}
            >
              <div className={styles.actionIconBox}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5z" />
                </svg>
              </div>
              <div className={styles.actionText}>
                <span className={styles.actionTitle}>모임 생성</span>
                <span className={styles.actionDescription}>
                  새로운 모임을 만들어보세요
                </span>
              </div>
            </button>

            <button
              type="button"
              className={styles.actionCard}
              onClick={handleJoinOpen}
            >
              <div className={styles.actionIconBox}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 4a8 8 0 1 1-8 8h2a6 6 0 1 0 6-6V4zm1 6h6v2h-6v6h-2v-6H5v-2h6V4h2v6z" />
                </svg>
              </div>
              <div className={styles.actionText}>
                <span className={styles.actionTitle}>모임 참여</span>
                <span className={styles.actionDescription}>
                  초대 코드로 모임에 참여하세요
                </span>
              </div>
            </button>
          </section>

          <section className={styles.listSection}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>내 모임 목록</h2>
            </div>

            {meetingsState === 'loading' ? (
              <div className={styles.placeholder}>모임을 불러오는 중...</div>
            ) : meetingsState === 'error' ? (
              <div className={styles.placeholder}>
                {meetingsError ?? '모임 목록을 불러오지 못했어요.'}
              </div>
            ) : meetings.length === 0 ? (
              <div className={styles.placeholder}>
                아직 참여한 모임이 없어요.
              </div>
            ) : (
              <div className={styles.meetingList}>
                {meetings.map((meeting) => (
                  <button
                    type="button"
                    key={meeting.meetingId}
                    className={styles.meetingCard}
                    onClick={() => navigate(`/meetings/${meeting.meetingId}`)}
                  >
                    <div className={styles.meetingHeader}>
                      <span className={styles.meetingTitle}>{meeting.title}</span>
                      {meeting.finalSelected ? (
                        <span className={styles.badge}>최종 확정</span>
                      ) : null}
                    </div>
                    <div className={styles.meetingMeta}>
                      <div className={styles.metaRow}>
                        <span className={styles.metaIcon} aria-hidden="true">
                          <svg viewBox="0 0 24 24">
                            <path d="M12 2a10 10 0 1 0 10 10A10.01 10.01 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8.01 8.01 0 0 1-8 8zm.5-13H11v6l5 3 .75-1.23-4.25-2.52z" />
                          </svg>
                        </span>
                        <span>{formatDateTime(meeting.scheduledAt)}</span>
                      </div>
                      <span className={styles.metaAddress}>{meeting.locationAddress}</span>
                    </div>
                    <div className={styles.meetingStats}>
                      <span className={styles.metaRow}>
                        <span className={styles.metaIcon} aria-hidden="true">
                          <svg viewBox="0 0 24 24">
                            <path d="M16 11a4 4 0 1 0-4-4 4 4 0 0 0 4 4zM8 12a3.5 3.5 0 1 0-3.5-3.5A3.5 3.5 0 0 0 8 12zm8 1c-2.33 0-7 1.17-7 3.5V19h14v-2.5C23 14.17 18.33 13 16 13zM8 13c-1.9 0-5 1-5 3v3h5v-2.5c0-1.09.52-2.03 1.35-2.7A7.65 7.65 0 0 0 8 13z" />
                          </svg>
                        </span>
                        <span>
                          {meeting.participantCount}/{meeting.targetHeadcount}명
                        </span>
                      </span>
                      <span>{meetingStatusLabel(meeting.meetingStatus)}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        </main>

        <BottomNav />
      </div>

      {joinModalOpen ? (
        <div className={styles.modalBackdrop} role="presentation" onClick={handleJoinClose}>
          <div
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="join-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className={styles.modalTitle} id="join-modal-title">
              모임 참여
            </h3>
            <p className={styles.modalDescription}>
              초대 코드를 입력하면 모임으로 바로 이동해요.
            </p>
            <input
              className={styles.modalInput}
              value={inviteCode}
              onChange={(event) => setInviteCode(event.target.value)}
              placeholder="초대 코드 입력"
            />
            {joinError ? (
              <p className={styles.modalError}>{joinError}</p>
            ) : null}
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.modalCancel}
                onClick={handleJoinClose}
              >
                취소
              </button>
              <button
                type="button"
                className={styles.modalConfirm}
                onClick={handleJoinConfirm}
                disabled={joinState === 'loading'}
              >
                {joinState === 'loading' ? '참여 중...' : '확인'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
