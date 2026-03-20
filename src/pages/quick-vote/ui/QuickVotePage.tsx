import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import styles from './QuickVotePage.module.css'
import { ApiError } from '@/shared/lib/api'
import {
  getQuickVoteCandidates,
  getQuickVoteStatus,
  submitQuickVote,
  type QuickVoteCandidate,
  type QuickVoteSubmitItem,
  type QuickVoteStatusResponse,
} from '@/entities/quick-meeting'
import type { VoteChoice } from '@/entities/vote'
import { getQuickSession, saveQuickSession } from '@/shared/lib/quick-session'
import { navigate } from '@/shared/lib/navigation'

type SwipeState = {
  startX: number
  startY: number
  deltaX: number
  deltaY: number
  isDragging: boolean
}

const swipeThreshold = 80

function normalizeInviteCode(value: string | undefined) {
  return (value ?? '').trim().toUpperCase()
}

function formatLeftTime(deadline: string) {
  const remainMs = new Date(deadline).getTime() - Date.now()
  if (!Number.isFinite(remainMs) || remainMs <= 0) return '마감됨'
  const totalSec = Math.floor(remainMs / 1000)
  const min = String(Math.floor(totalSec / 60)).padStart(2, '0')
  const sec = String(totalSec % 60).padStart(2, '0')
  return `${min}:${sec}`
}

export function QuickVotePage() {
  const { inviteCode: inviteCodeParam } = useParams()
  const inviteCode = normalizeInviteCode(inviteCodeParam)
  const session = useMemo(() => getQuickSession(inviteCode), [inviteCode])

  const meetingId = session?.meetingId ?? null
  const voteId = session?.currentVoteId ?? null

  const [leftTime, setLeftTime] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [candidates, setCandidates] = useState<QuickVoteCandidate[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [imageIndex, setImageIndex] = useState(0)
  const [choices, setChoices] = useState<QuickVoteSubmitItem[]>([])
  const [history, setHistory] = useState<QuickVoteSubmitItem[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [status, setStatus] = useState<QuickVoteStatusResponse | null>(null)
  const [swipeState, setSwipeState] = useState<SwipeState>({
    startX: 0,
    startY: 0,
    deltaX: 0,
    deltaY: 0,
    isDragging: false,
  })
  const pointerIdRef = useRef<number | null>(null)

  useEffect(() => {
    if (!session || voteId === null) {
      navigate(`/quick/${inviteCode}`, { replace: true })
      return
    }

    let active = true
    let timerId: number | null = null
    let attempt = 0

    const fetchCandidates = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await getQuickVoteCandidates(meetingId as number, voteId)
        if (!active) return
        setCandidates(response.candidates ?? [])
        setCurrentIndex(0)
        setImageIndex(0)
        setChoices([])
        setHistory([])
      } catch (err) {
        if (!active) return
        if (err instanceof ApiError && err.status === 409 && attempt < 20) {
          attempt += 1
          timerId = window.setTimeout(fetchCandidates, 1500)
          return
        }
        setError(err instanceof Error ? err.message : '투표 후보를 불러오지 못했어요.')
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void fetchCandidates()

    return () => {
      active = false
      if (timerId) window.clearTimeout(timerId)
    }
  }, [inviteCode, meetingId, session, voteId])

  useEffect(() => {
    if (!session?.voteDeadlineAt) return
    const update = () => setLeftTime(formatLeftTime(session.voteDeadlineAt))
    update()
    const timerId = window.setInterval(update, 1000)
    return () => window.clearInterval(timerId)
  }, [session?.voteDeadlineAt])

  useEffect(() => {
    if (!submitted || meetingId === null || voteId === null || !session) return

    let active = true
    const poll = async () => {
      try {
        const response = await getQuickVoteStatus(meetingId, voteId)
        if (!active) return
        setStatus(response)
        if (response.voteStatus === 'COUNTED') {
          saveQuickSession(inviteCode, { ...session, voteStatus: 'COUNTED' })
          navigate(`/quick/${inviteCode}/result`, { replace: true })
        }
      } catch {
        // noop
      }
    }

    void poll()
    const timerId = window.setInterval(poll, 2000)

    return () => {
      active = false
      window.clearInterval(timerId)
    }
  }, [inviteCode, meetingId, session, submitted, voteId])

  const currentCandidate = candidates[currentIndex]
  const images = useMemo(() => {
    if (!currentCandidate) return []
    const list = [
      currentCandidate.imageUrl1,
      currentCandidate.imageUrl2,
      currentCandidate.imageUrl3,
    ].filter(Boolean) as string[]
    return Array.from(new Set(list))
  }, [currentCandidate])

  useEffect(() => {
    setImageIndex(0)
  }, [currentIndex])

  const totalCount = candidates.length
  const votedCount = choices.length

  const handleVote = useCallback(
    async (choice: VoteChoice) => {
      if (!currentCandidate || submitting || submitted || meetingId === null || voteId === null) {
        return
      }

      const nextItem = {
        candidateId: currentCandidate.candidateId,
        choice,
        useCoupon: false,
      }

      const nextChoices = [...choices, nextItem]
      setChoices(nextChoices)
      setHistory((prev) => [...prev, nextItem])
      const nextIndex = currentIndex + 1
      setCurrentIndex(nextIndex)
      setSwipeState((prev) => ({ ...prev, deltaX: 0, deltaY: 0, isDragging: false }))

      if (nextIndex >= candidates.length) {
        try {
          setSubmitting(true)
          await submitQuickVote(meetingId, voteId, { items: nextChoices })
          setSubmitted(true)
        } catch (err) {
          if (err instanceof ApiError && err.status === 409) {
            setSubmitted(true)
          } else {
            setError(err instanceof Error ? err.message : '투표 저장에 실패했어요.')
          }
        } finally {
          setSubmitting(false)
        }
      }
    },
    [
      candidates.length,
      choices,
      currentCandidate,
      currentIndex,
      meetingId,
      submitted,
      submitting,
      voteId,
    ],
  )

  const handleUndo = () => {
    if (history.length === 0 || submitting || submitted) return
    const nextHistory = history.slice(0, -1)
    const last = history[history.length - 1]
    setHistory(nextHistory)
    setChoices((prev) => prev.slice(0, -1))
    const targetIndex = Math.max(currentIndex - 1, 0)
    if (last && candidates[targetIndex]?.candidateId === last.candidateId) {
      setCurrentIndex(targetIndex)
    } else {
      setCurrentIndex(Math.max(currentIndex - 1, 0))
    }
  }

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!currentCandidate || submitting || submitted) return
    pointerIdRef.current = event.pointerId
    event.currentTarget.setPointerCapture(event.pointerId)
    setSwipeState({
      startX: event.clientX,
      startY: event.clientY,
      deltaX: 0,
      deltaY: 0,
      isDragging: true,
    })
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!swipeState.isDragging || pointerIdRef.current !== event.pointerId) return
    setSwipeState((prev) => ({
      ...prev,
      deltaX: event.clientX - prev.startX,
      deltaY: event.clientY - prev.startY,
    }))
  }

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!swipeState.isDragging || pointerIdRef.current !== event.pointerId) return
    event.currentTarget.releasePointerCapture(event.pointerId)
    pointerIdRef.current = null

    const { deltaX, deltaY } = swipeState
    const absX = Math.abs(deltaX)
    const absY = Math.abs(deltaY)

    if (absX > swipeThreshold && absX >= absY) {
      void handleVote(deltaX > 0 ? 'LIKE' : 'DISLIKE')
      return
    }

    if (absY > swipeThreshold && absY > absX && deltaY < 0) {
      void handleVote('NEUTRAL')
      return
    }

    setSwipeState((prev) => ({ ...prev, deltaX: 0, deltaY: 0, isDragging: false }))
  }

  const progressRatio = totalCount > 0 ? (votedCount / totalCount) * 100 : 0
  const disableActions = !currentCandidate || submitting || loading || submitted

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        {!submitted ? (
          <button
            type="button"
            className={styles.backButton}
            onClick={() => navigate(`/quick/${inviteCode}`)}
            aria-label="퀵모임 상세로 돌아가기"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        ) : null}
        <div className={styles.progressWrapper}>
          <div className={styles.progressText}>
            {votedCount}/{totalCount}
          </div>
          <div className={styles.progressBar}>
            <div className={styles.progressFill} style={{ width: `${progressRatio}%` }} />
          </div>
        </div>
      </header>

      <p className={styles.deadline}>마감까지 {leftTime || '확인 중...'}</p>
      {loading && <p className={styles.note}>후보를 불러오는 중...</p>}
      {error && <p className={styles.note}>{error}</p>}

      {submitted ? (
        <section className={styles.waitCard}>
          <p className={styles.waitStatus}>
            <span className={styles.spinner} aria-hidden="true" />
            {status ? `${status.submittedCount}/${status.totalCount}명 제출` : '제출 현황 확인 중'}
            <span className={styles.dotsTight} aria-hidden="true" />
          </p>
          <p className={styles.waitTitle}>투표를 제출했어요.</p>
          <p className={styles.waitDescription}>투표 결과가 나오면 결과 화면으로 이동합니다.</p>
        </section>
      ) : null}

      {!loading && !error && !submitted && currentCandidate && (
        <section className={styles.cardArea}>
          <div
            className={styles.card}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            style={{
              transform: `translate(${swipeState.deltaX}px, ${swipeState.deltaY}px) rotate(${swipeState.deltaX * 0.05}deg)`,
            }}
          >
            <div className={styles.imageArea}>
              {images.length > 0 ? (
                <>
                  <img
                    src={images[imageIndex]}
                    alt={currentCandidate.restaurantName}
                    draggable={false}
                    onDragStart={(event) => event.preventDefault()}
                  />
                  {images.length > 1 && (
                    <div className={styles.imageNav}>
                      <button
                        type="button"
                        className={styles.imageButton}
                        onPointerDown={(event) => event.stopPropagation()}
                        onPointerUp={(event) => event.stopPropagation()}
                        onClick={(event) => {
                          event.stopPropagation()
                          setImageIndex((prev) => (prev - 1 + images.length) % images.length)
                        }}
                        aria-label="이전 이미지"
                      >
                        ‹
                      </button>
                      <div className={styles.imageDots}>
                        {images.map((_, index) => (
                          <span
                            key={`dot-${index}`}
                            className={index === imageIndex ? styles.dotActive : styles.dot}
                          />
                        ))}
                      </div>
                      <button
                        type="button"
                        className={styles.imageButton}
                        onPointerDown={(event) => event.stopPropagation()}
                        onPointerUp={(event) => event.stopPropagation()}
                        onClick={(event) => {
                          event.stopPropagation()
                          setImageIndex((prev) => (prev + 1) % images.length)
                        }}
                        aria-label="다음 이미지"
                      >
                        ›
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className={styles.imagePlaceholder}>이미지가 없어요</div>
              )}
            </div>

            <div className={styles.infoArea}>
              <div className={styles.titleRow}>
                <h2 className={styles.restaurantName}>{currentCandidate.restaurantName}</h2>
                <span className={styles.category}>{currentCandidate.categoryName}</span>
              </div>
              <div className={styles.metaRow}>
                <span>거리 {currentCandidate.distanceM}m</span>
                <span>별점 {currentCandidate.rating}</span>
              </div>
              <div className={styles.address}>
                {currentCandidate.roadAddress || currentCandidate.jibunAddress}
              </div>
            </div>
          </div>
        </section>
      )}

      {!loading && !error && !submitted && !currentCandidate && (
        <p className={styles.note}>모든 투표가 완료되었어요.</p>
      )}

      {!submitted && (
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.actionButton}
            onClick={() => {
              void handleVote('DISLIKE')
            }}
            disabled={disableActions}
          >
            싫어요
          </button>
          <button
            type="button"
            className={styles.actionButton}
            onClick={() => {
              void handleVote('NEUTRAL')
            }}
            disabled={disableActions}
          >
            중립
          </button>
          <button
            type="button"
            className={styles.actionButton}
            onClick={() => {
              void handleVote('LIKE')
            }}
            disabled={disableActions}
          >
            좋아요
          </button>
          <button
            type="button"
            className={styles.undoButton}
            onClick={handleUndo}
            disabled={disableActions}
          >
            되돌리기
          </button>
        </div>
      )}
    </div>
  )
}
