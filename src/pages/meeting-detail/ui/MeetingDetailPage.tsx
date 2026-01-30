import { useEffect, useMemo, useState } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import styles from './MeetingDetailPage.module.css'
import { useAuth } from '@/app/providers/auth-context'
import { navigate } from '@/shared/lib/navigation'
import { request } from '@/shared/lib/api'

type MeetingDetailResponse = {
  meetingId: number
  title: string
  scheduledAt: string
  voteDeadlineAt: string
  locationAddress: string
  locationLat: number
  locationLng: number
  targetHeadcount: number
  searchRadiusM: number
  swipeCount: number
  exceptMeat: boolean
  exceptBar: boolean
  quickMeeting: boolean
  inviteCode: string
  hostMemberId: number
  participantCount: number
  participants: MeetingParticipantSummary[]
  currentVoteId: number | null
  voteStatus: string | null
  hasVotedCurrent: boolean
  finalSelected: boolean
  meetingStatus: string
}

type MeetingParticipantSummary = {
  memberId: number
  nickname: string
  profileImageUrl: string | null
}

function formatDateTime(value: string) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function MeetingDetailPage() {
  const { meetingId } = useParams()
  const { member } = useAuth()
  const { search } = useLocation()
  const [data, setData] = useState<MeetingDetailResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [modalMessage, setModalMessage] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    if (!meetingId) return
    let active = true

    const fetchDetail = async () => {
      try {
        setLoading(true)
        setError(null)
        const payload = await request<MeetingDetailResponse>(`/api/v1/meetings/${meetingId}`)
        if (!active) return
        setData(payload)
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err.message : '모임 상세 정보를 불러오지 못했습니다.')
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void fetchDetail()
    return () => {
      active = false
    }
  }, [meetingId])

  const isHost = useMemo(() => {
    if (!data) return false
    if (!member?.memberId) return false
    return data.hostMemberId === member.memberId
  }, [data, member])

  const canEditMeeting = Boolean(data && isHost && data.currentVoteId === null)
  const isAllParticipantsReady = Boolean(
    data && data.participantCount >= data.targetHeadcount,
  )

  const primaryAction = useMemo(() => {
    if (!data) return { label: '', disabled: true, onClick: () => {} }

    if (data.finalSelected) {
      return {
        label: '최종 결과 보기',
        disabled: false,
        onClick: () => navigate(`/meetings/${data.meetingId}/final`),
      }
    }

    if (data.voteStatus === 'COUNTED') {
      return {
        label: '결과보기',
        disabled: false,
        onClick: () =>
          data.currentVoteId &&
          navigate(`/meetings/${data.meetingId}/votes/${data.currentVoteId}/top3`),
      }
    }

    if (data.voteStatus === 'OPEN') {
      return {
        label: data.hasVotedCurrent ? '투표 완료' : '투표 시작하기',
        disabled: data.hasVotedCurrent,
        onClick: () =>
          data.currentVoteId &&
          navigate(`/meetings/${data.meetingId}/votes/${data.currentVoteId}`),
      }
    }

    if (
      (data.voteStatus === null ||
        data.voteStatus === 'GENERATING' ||
        data.voteStatus === 'RESERVED' ||
        data.voteStatus === 'COUNTING' ||
        data.voteStatus === 'FAILED') &&
      isHost
    ) {
      const actionLabel =
        data.voteStatus === 'FAILED' ? '투표 다시 생성하기' : '투표 생성하기'
      return {
        label: actionLabel,
        disabled: false,
        onClick: () => {
          if (!isAllParticipantsReady) {
            setModalMessage('모든 인원이 참여중이어야 투표를 생성할 수 있어요.')
            return
          }
          navigate(`/votes/new?meetingId=${data.meetingId}`)
        },
      }
    }

    if (
      (data.voteStatus === null ||
        data.voteStatus === 'GENERATING' ||
        data.voteStatus === 'RESERVED' ||
        data.voteStatus === 'COUNTING' ||
        data.voteStatus === 'FAILED') &&
      !isHost
    ) {
      return { label: '투표 준비 중', disabled: true, onClick: () => {} }
    }

    return { label: '투표 준비 중', disabled: true, onClick: () => {} }
  }, [data, isAllParticipantsReady, isHost])

  const handleDeleteMeeting = async () => {
    if (!data) return
    const confirmed = window.confirm('모임을 삭제할까요? 삭제 후 복구할 수 없습니다.')
    if (!confirmed) return

    try {
      setIsDeleting(true)
      await request<void>(`/api/v1/meetings/${data.meetingId}`, { method: 'DELETE' })

      navigate('/main')
    } catch (err) {
      setModalMessage(err instanceof Error ? err.message : '모임 삭제에 실패했습니다.')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleLeaveMeeting = async () => {
    if (!data) return
    const confirmed = window.confirm('모임을 떠날까요? 다시 참여하려면 초대가 필요합니다.')
    if (!confirmed) return

    try {
      setIsDeleting(true)
      await request<void>(`/api/v1/meetings/${data.meetingId}/members/me`, {
        method: 'DELETE',
      })

      navigate('/main')
    } catch (err) {
      setModalMessage(err instanceof Error ? err.message : '모임 떠나기에 실패했습니다.')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button
          type="button"
          className={styles.backButton}
          onClick={() => window.history.back()}
          aria-label="뒤로가기"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className={styles.title}>모임 상세</h1>
      </header>

      {loading && <p className={styles.note}>불러오는 중...</p>}
      {error && <p className={styles.note}>{error}</p>}

      {!loading && !error && data && (
        <>
          {canEditMeeting && (
            <button
              type="button"
              className={styles.editButton}
              onClick={() => navigate(`/meetings/${data.meetingId}/edit`)}
            >
              모임 수정
            </button>
          )}

          <section className={styles.detailCard}>
            <div className={styles.detailHeader}>
              <h2 className={styles.detailTitle}>{data.title}</h2>
              <span className={styles.statusBadge}>{data.meetingStatus}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>모임 시간</span>
              <span className={styles.detailValue}>{formatDateTime(data.scheduledAt)}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>모임 주소</span>
              <span className={styles.detailValue}>{data.locationAddress}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>투표 마감</span>
              <span className={styles.detailValue}>{formatDateTime(data.voteDeadlineAt)}</span>
            </div>
          </section>

          <section className={styles.participantsSection}>
            <div className={styles.participantsHeader}>
              <h3 className={styles.sectionTitle}>현재 참가자</h3>
              <span className={styles.countText}>
                {data.participantCount}/{data.targetHeadcount}
              </span>
            </div>
            <div className={styles.participantsGrid}>
              {data.participants.map((participant) => (
                <div className={styles.participantCard} key={participant.memberId}>
                  <div className={styles.avatar}>
                    {participant.profileImageUrl ? (
                      <img src={participant.profileImageUrl} alt={participant.nickname} />
                    ) : (
                      <span>{participant.nickname.charAt(0)}</span>
                    )}
                  </div>
                  <span className={styles.participantName}>{participant.nickname}</span>
                </div>
              ))}
            </div>
          </section>

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.primaryAction}
              onClick={primaryAction.onClick}
              disabled={primaryAction.disabled}
            >
              {primaryAction.label}
            </button>
            <button
              type="button"
              className={styles.secondaryAction}
              onClick={() => {
                if (isHost) {
                  void handleDeleteMeeting()
                  return
                }
                void handleLeaveMeeting()
              }}
              disabled={isHost && isDeleting}
            >
              {isHost ? (isDeleting ? '삭제 중...' : '모임 삭제하기') : '모임 떠나기'}
            </button>
          </div>
        </>
      )}

      {modalMessage && (
        <div className={styles.modalBackdrop} role="presentation" onClick={() => setModalMessage(null)}>
          <div
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <p className={styles.modalText}>{modalMessage}</p>
            <button type="button" className={styles.modalButton} onClick={() => setModalMessage(null)}>
              확인
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
