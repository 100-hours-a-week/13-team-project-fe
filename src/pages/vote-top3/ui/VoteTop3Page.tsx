import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import styles from './VoteTop3Page.module.css'
import {
  finalizeSelection,
  getVoteCandidates,
  getVoteResults,
  type VoteResultsItem,
} from '@/entities/vote'
import { useAuth } from '@/app/providers/auth-context'
import { navigate } from '@/shared/lib/navigation'
import { request } from '@/shared/lib/api'

type LoadState = 'idle' | 'loading' | 'error'

type MeetingDetailResponse = {
  hostMemberId: number
}

export function VoteTop3Page() {
  const { meetingId, voteId } = useParams()
  const { member } = useAuth()
  const [results, setResults] = useState<VoteResultsItem[]>([])
  const [isHost, setIsHost] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [alertMessage, setAlertMessage] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [recoState, setRecoState] = useState<LoadState>('idle')
  const [finalState, setFinalState] = useState<LoadState>('idle')

  const parsedMeetingId = Number(meetingId)
  const parsedVoteId = Number(voteId)

  const backPath = useMemo(() => {
    if (meetingId) return `/meetings/${meetingId}`
    return '/main'
  }, [meetingId])

  const fetchData = useCallback(async () => {
    if (!Number.isFinite(parsedMeetingId) || !Number.isFinite(parsedVoteId)) {
      setError('투표 정보를 찾을 수 없습니다.')
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      const [resultsResponse, meetingData] = await Promise.all([
        getVoteResults(parsedMeetingId, parsedVoteId),
        request<MeetingDetailResponse>(`/api/v1/meetings/${parsedMeetingId}`),
      ])
      setIsHost(meetingData.hostMemberId === (member?.memberId ?? null))
      setResults(resultsResponse.items ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : '투표 결과를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [member?.memberId, parsedMeetingId, parsedVoteId])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  const sortedResults = useMemo(() => {
    return [...results].sort((a, b) => a.rank - b.rank)
  }, [results])

  const handleSelect = useCallback(
    (candidateId: number) => {
      if (!isHost) return
      setSelectedId(candidateId)
    },
    [isHost],
  )

  const handleReRecommend = useCallback(async () => {
    if (!Number.isFinite(parsedMeetingId) || !Number.isFinite(parsedVoteId)) return
    if (!isHost) return
    try {
      setRecoState('loading')
      await request<void>(
        `/api/v1/meetings/${parsedMeetingId}/votes/${parsedVoteId}/start-revote`,
        { method: 'POST' },
      )
      await getVoteCandidates(parsedMeetingId, parsedVoteId)
      navigate(`/meetings/${parsedMeetingId}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : '재추천 요청에 실패했습니다.'
      if (message.includes('vote_not_open')) {
        navigate(`/meetings/${parsedMeetingId}`)
        return
      }
      if (message.includes('vote_deadline_passed')) {
        setAlertMessage('재추천 요청에 실패했습니다. (투표 시간 마감)')
        return
      }
      setAlertMessage(`재추천 요청에 실패했습니다. (${message})`)
    } finally {
      setRecoState('idle')
    }
  }, [isHost, parsedMeetingId, parsedVoteId])

  const handleFinalize = useCallback(async () => {
    if (!Number.isFinite(parsedMeetingId) || !Number.isFinite(parsedVoteId)) return
    if (!selectedId) {
      setError('최종 선택할 식당을 선택해주세요.')
      return
    }

    try {
      setFinalState('loading')
      await finalizeSelection(parsedMeetingId, parsedVoteId, { candidateId: selectedId })
      navigate(`/meetings/${parsedMeetingId}/final`)
    } catch (err) {
      setError(err instanceof Error ? err.message : '최종 선택에 실패했습니다.')
    } finally {
      setFinalState('idle')
    }
  }, [parsedMeetingId, parsedVoteId, selectedId])

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button
          type="button"
          className={styles.backButton}
          onClick={() => navigate(backPath)}
          aria-label="모임 상세로 돌아가기"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className={styles.title}>TOP 3 결과</h1>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroBadge}>
          <span className={styles.checkIcon} aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M5 13l4 4L19 7" />
            </svg>
          </span>
          <span className={styles.heroTitle}>TOP3</span>
        </div>
        <p className={styles.heroText}>모두가 선택한 Top3 식당이에요!</p>
      </section>

      {loading && <p className={styles.note}>결과를 불러오는 중...</p>}
      {error && <p className={styles.note}>{error}</p>}

      {!loading && !error && (
        <section className={styles.list}>
          {sortedResults.map((item) => {
            const address = item.roadAddress || item.jibunAddress
            const selected = item.candidateId === selectedId
            return (
              <button
                type="button"
                key={item.candidateId}
                className={selected ? styles.cardSelected : styles.card}
                onClick={() => handleSelect(item.candidateId)}
                disabled={!isHost}
              >
                <div className={styles.rankBadge}>{item.rank}등</div>
                <div className={styles.cardContent}>
                  <div className={styles.imageWrap}>
                    {item.imageUrl1 ? (
                      <img src={item.imageUrl1} alt={item.restaurantName} />
                    ) : (
                      <div className={styles.imagePlaceholder}>이미지 없음</div>
                    )}
                  </div>
                <div className={styles.info}>
                  <div className={styles.nameRow}>
                    <h3 className={styles.name}>{item.restaurantName}</h3>
                    <span className={styles.categoryInline}>{item.categoryName}</span>
                  </div>
                  <div className={styles.meta}>
                    <span>별점 {item.rating}</span>
                    <span>거리 {item.distanceM}m</span>
                  </div>
                  <div className={styles.address}>{address}</div>
                </div>
              </div>
            </button>
          )
        })}
        </section>
      )}

      {isHost && (
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={handleReRecommend}
            disabled={recoState === 'loading'}
          >
            재추천 받기
          </button>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={handleFinalize}
            disabled={!selectedId || finalState === 'loading'}
          >
            최종 선택 확정
          </button>
        </div>
      )}

      {alertMessage && (
        <div className={styles.modalBackdrop} role="presentation" onClick={() => setAlertMessage(null)}>
          <div
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <p className={styles.modalText}>{alertMessage}</p>
            <button type="button" className={styles.modalButton} onClick={() => setAlertMessage(null)}>
              확인
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
