import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import styles from './VotePage.module.css'
import {
  getVoteCandidates,
  submitVote,
  type VoteCandidate,
  type VoteChoice,
  type VoteSubmitItem,
} from '@/entities/vote'
import { navigate } from '@/shared/lib/navigation'

type SwipeState = {
  startX: number
  startY: number
  deltaX: number
  deltaY: number
  isDragging: boolean
}

const swipeThreshold = 80

export function VotePage() {
  const { meetingId, voteId } = useParams()
  const parsedMeetingId = Number(meetingId)
  const parsedVoteId = Number(voteId)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [candidates, setCandidates] = useState<VoteCandidate[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [imageIndex, setImageIndex] = useState(0)
  const [choices, setChoices] = useState<VoteSubmitItem[]>([])
  const [history, setHistory] = useState<VoteSubmitItem[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [swipeState, setSwipeState] = useState<SwipeState>({
    startX: 0,
    startY: 0,
    deltaX: 0,
    deltaY: 0,
    isDragging: false,
  })
  const pointerIdRef = useRef<number | null>(null)

  useEffect(() => {
    if (!Number.isFinite(parsedMeetingId) || !Number.isFinite(parsedVoteId)) {
      setError('투표 정보를 불러올 수 없어요.')
      return
    }

    let active = true

    const fetchCandidates = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await getVoteCandidates(parsedMeetingId, parsedVoteId)
        if (!active) return
        setCandidates(response.candidates ?? [])
        setCurrentIndex(0)
        setImageIndex(0)
        setChoices([])
        setHistory([])
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err.message : '투표 후보를 불러오지 못했어요.')
      } finally {
        if (!active) return
        setLoading(false)
      }
    }

    void fetchCandidates()
    return () => {
      active = false
    }
  }, [parsedMeetingId, parsedVoteId])

  const currentCandidate = candidates[currentIndex]
  const images = useMemo(() => {
    if (!currentCandidate) return []
    return [currentCandidate.imageUrl1, currentCandidate.imageUrl2, currentCandidate.imageUrl3].filter(
      Boolean,
    ) as string[]
  }, [currentCandidate])

  useEffect(() => {
    setImageIndex(0)
  }, [currentIndex])

  const totalCount = candidates.length
  const votedCount = choices.length

  const handleVote = useCallback(
    async (choice: VoteChoice) => {
      if (!currentCandidate || submitting) return

      const nextItem: VoteSubmitItem = {
        candidateId: currentCandidate.candidateId,
        choice,
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
          await submitVote(parsedMeetingId, parsedVoteId, { items: nextChoices })
          navigate(`/meetings/${parsedMeetingId}/votes/${parsedVoteId}/wait`)
        } catch (err) {
          setError(err instanceof Error ? err.message : '투표 저장에 실패했어요.')
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
      parsedMeetingId,
      parsedVoteId,
      submitting,
    ],
  )

  const handleUndo = () => {
    if (history.length === 0 || submitting) return
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
    if (!currentCandidate || submitting) return
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

  const disableActions = !currentCandidate || submitting || loading

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
        <div className={styles.progressWrapper}>
          <div className={styles.progressText}>
            {votedCount}/{totalCount}
          </div>
          <div className={styles.progressBar}>
            <div className={styles.progressFill} style={{ width: `${progressRatio}%` }} />
          </div>
        </div>
      </header>

      {loading && <p className={styles.note}>후보를 불러오는 중...</p>}
      {error && <p className={styles.note}>{error}</p>}

      {!loading && !error && currentCandidate && (
        <section className={styles.cardArea}>
          <div
            className={styles.card}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            style={{
              transform: `translate(${swipeState.deltaX}px, ${swipeState.deltaY}px) rotate(${
                swipeState.deltaX * 0.05
              }deg)`,
            }}
          >
            <div className={styles.imageArea}>
              {images.length > 0 ? (
                <>
                  <img src={images[imageIndex]} alt={currentCandidate.restaurantName} />
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

      {!loading && !error && !currentCandidate && (
        <p className={styles.note}>모든 투표가 완료되었어요.</p>
      )}

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.actionButton}
          onClick={() => handleVote('DISLIKE')}
          disabled={disableActions}
        >
          싫어요
        </button>
        <button
          type="button"
          className={styles.actionButton}
          onClick={() => handleVote('NEUTRAL')}
          disabled={disableActions}
        >
          중립
        </button>
        <button
          type="button"
          className={styles.actionButton}
          onClick={() => handleVote('LIKE')}
          disabled={disableActions}
        >
          좋아요
        </button>
        <button type="button" className={styles.undoButton} onClick={handleUndo} disabled={disableActions}>
          되돌리기
        </button>
      </div>
    </div>
  )
}
