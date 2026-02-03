import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import styles from './MeetingDetailPage.module.css'
import { useAuth } from '@/app/providers/auth-context'
import { navigate } from '@/shared/lib/navigation'
import { request } from '@/shared/lib/api'
import { BottomNav } from '@/shared/ui/bottom-nav'

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

type MeetingDetailStateResponse = {
  meetingStatus: string
  voteStatus: string | null
  currentVoteId: number | null
  participantCount: number
  participants: MeetingParticipantSummary[]
  hasVotedCurrent: boolean
  finalSelected: boolean
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
  const [data, setData] = useState<MeetingDetailResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [modalMessage, setModalMessage] = useState<string | null>(null)
  const [confirmAction, setConfirmAction] = useState<'delete' | 'leave' | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [copyNotice, setCopyNotice] = useState<string | null>(null)
  const pollTimerRef = useRef<number | null>(null)
  const isFetchingStateRef = useRef(false)
  const stateSnapshotRef = useRef<MeetingDetailStateResponse | null>(null)
  const lastNotifiedVoteIdRef = useRef<number | null>(null)
  const notifiedVoteIdsRef = useRef<Set<number>>(new Set())

  const fetchDetail = useCallback(async () => {
    if (!meetingId) return
    try {
      setLoading(true)
      setError(null)
      const payload = await request<MeetingDetailResponse>(`/api/v1/meetings/${meetingId}`)
      setData(payload)
    } catch (err) {
      setError(err instanceof Error ? err.message : '모임 상세 정보를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [meetingId])

  const applyStateToDetail = useCallback((state: MeetingDetailStateResponse) => {
    setData((prev) => {
      if (!prev) return prev
      if (notifiedVoteIdsRef.current.size === 0) {
        const stored = sessionStorage.getItem('notifiedVoteIds')
        if (stored) {
          try {
            const ids = JSON.parse(stored) as number[]
            if (Array.isArray(ids)) {
              notifiedVoteIdsRef.current = new Set(ids)
            }
          } catch {
            // ignore
          }
        }
      }
      return {
        ...prev,
        meetingStatus: state.meetingStatus,
        voteStatus: state.voteStatus,
        currentVoteId: state.currentVoteId,
        participantCount: state.participantCount,
        participants: state.participants ?? prev.participants,
        hasVotedCurrent: state.hasVotedCurrent,
        finalSelected: state.finalSelected,
      }
    })
  }, [])

  const getPollDelayMs = useCallback((state: MeetingDetailStateResponse | null) => {
    if (!state) return 3000
    if (state.finalSelected) return null
    if (state.voteStatus === 'COUNTED') return null
    if (state.voteStatus === 'FAILED') return null
    if (state.voteStatus === 'GENERATING') return 1500
    if (state.voteStatus === 'COUNTING') return 1500
    if (state.voteStatus === 'OPEN') return 4000
    return 3000
  }, [])

  const fetchState = useCallback(async () => {
    if (!meetingId) return
    if (isFetchingStateRef.current) return
    isFetchingStateRef.current = true
    try {
      const state = await request<MeetingDetailStateResponse>(
        `/api/v1/meetings/${meetingId}/state`,
      )
      applyStateToDetail(state)

      const prev = stateSnapshotRef.current
      const shouldRefetchDetail =
        !prev ||
        prev.currentVoteId !== state.currentVoteId ||
        prev.participantCount !== state.participantCount ||
        prev.meetingStatus !== state.meetingStatus ||
        prev.voteStatus !== state.voteStatus ||
        prev.hasVotedCurrent !== state.hasVotedCurrent ||
        prev.finalSelected !== state.finalSelected ||
        (state.meetingStatus === 'READY' && prev.participants?.length !== state.participants?.length)

      if (state.voteStatus === 'OPEN' && state.currentVoteId) {
        const isNewVote = lastNotifiedVoteIdRef.current !== state.currentVoteId
        const alreadyNotified = notifiedVoteIdsRef.current.has(state.currentVoteId)
        if (isNewVote && !alreadyNotified) {
          lastNotifiedVoteIdRef.current = state.currentVoteId
          notifiedVoteIdsRef.current.add(state.currentVoteId)
          sessionStorage.setItem(
            'notifiedVoteIds',
            JSON.stringify(Array.from(notifiedVoteIdsRef.current)),
          )
          setModalMessage(
            prev?.currentVoteId
              ? '재투표가 시작되었어요. 다시 참여해 주세요!'
              : '투표가 시작되었어요. 지금 참여해 주세요!',
          )
        }
      }

      stateSnapshotRef.current = state

      if (shouldRefetchDetail) {
        void fetchDetail()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '모임 상태를 불러오지 못했습니다.')
    } finally {
      isFetchingStateRef.current = false
    }
  }, [applyStateToDetail, fetchDetail, meetingId])

  const scheduleNextPoll = useCallback(
    (state: MeetingDetailStateResponse | null) => {
      if (pollTimerRef.current) {
        window.clearTimeout(pollTimerRef.current)
        pollTimerRef.current = null
      }
      if (document.hidden) return
      const delay = getPollDelayMs(state)
      if (delay === null) return
      pollTimerRef.current = window.setTimeout(() => {
        void fetchState().then(() => {
          scheduleNextPoll(stateSnapshotRef.current)
        })
      }, delay)
    },
    [fetchState, getPollDelayMs],
  )

  useEffect(() => {
    void fetchDetail()
  }, [fetchDetail])

  useEffect(() => {
    if (!meetingId) return
    const handleFocus = () => {
      if (!document.hidden) {
        void fetchState().then(() => scheduleNextPoll(stateSnapshotRef.current))
      }
    }
    const handleVisibility = () => {
      if (document.hidden) {
        if (pollTimerRef.current) {
          window.clearTimeout(pollTimerRef.current)
          pollTimerRef.current = null
        }
        return
      }
      void fetchState().then(() => scheduleNextPoll(stateSnapshotRef.current))
    }

    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibility)

    void fetchState().then(() => scheduleNextPoll(stateSnapshotRef.current))

    return () => {
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibility)
      if (pollTimerRef.current) {
        window.clearTimeout(pollTimerRef.current)
        pollTimerRef.current = null
      }
    }
  }, [fetchState, meetingId, scheduleNextPoll])

  const isHost = useMemo(() => {
    if (!data) return false
    if (!member?.memberId) return false
    return data.hostMemberId === member.memberId
  }, [data, member])

  const isVoteActive = useMemo(() => {
    if (!data?.voteStatus) return false
    return ['GENERATING', 'OPEN', 'COUNTING'].includes(data.voteStatus)
  }, [data?.voteStatus])

  const canEditMeeting = Boolean(
    data &&
      isHost &&
      (data.currentVoteId === null || data.voteStatus === 'FAILED'),
  )
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
          void fetchState()
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
  }, [data, fetchState, isAllParticipantsReady, isHost])

  const handleDeleteMeeting = async () => {
    if (!data) return
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

  const handleCopyInviteCode = async () => {
    if (!data?.inviteCode) return
    try {
      await navigator.clipboard.writeText(data.inviteCode)
      setCopyNotice('모임 코드가 복사되었습니다.')
    } catch {
      setCopyNotice('복사에 실패했어요. 다시 시도해 주세요.')
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>모임 상세</h1>
      </header>

      {loading && <p className={styles.note}>불러오는 중...</p>}
      {error && <p className={styles.note}>{error}</p>}

      {!loading && data && (
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
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>모임 코드</span>
              <div className={styles.codeRow}>
                <span className={styles.codeValue}>{data.inviteCode}</span>
                <button
                  type="button"
                  className={styles.copyButton}
                  onClick={handleCopyInviteCode}
                >
                  복사
                </button>
              </div>
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
                if (isVoteActive) {
                  setModalMessage(
                    isHost
                      ? '투표가 진행 중일 때는 모임을 삭제할 수 없어요.'
                      : '투표가 진행 중일 때는 모임을 떠날 수 없어요.',
                  )
                  return
                }
                if (isHost) {
                  setConfirmAction('delete')
                  return
                }
                setConfirmAction('leave')
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

      {confirmAction && (
        <div className={styles.modalBackdrop} role="presentation" onClick={() => setConfirmAction(null)}>
          <div
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <p className={styles.modalText}>
              {confirmAction === 'delete'
                ? '모임을 삭제할까요? 삭제 후 복구할 수 없습니다.'
                : '모임을 떠날까요? 다시 참여하려면 초대가 필요합니다.'}
            </p>
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.modalCancel}
                onClick={() => setConfirmAction(null)}
              >
                취소
              </button>
              <button
                type="button"
                className={styles.modalConfirm}
                onClick={() => {
                  if (confirmAction === 'delete') {
                    void handleDeleteMeeting()
                  } else {
                    void handleLeaveMeeting()
                  }
                  setConfirmAction(null)
                }}
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {copyNotice && (
        <div className={styles.modalBackdrop} role="presentation" onClick={() => setCopyNotice(null)}>
          <div
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <p className={styles.modalText}>{copyNotice}</p>
            <button type="button" className={styles.modalButton} onClick={() => setCopyNotice(null)}>
              확인
            </button>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  )
}
