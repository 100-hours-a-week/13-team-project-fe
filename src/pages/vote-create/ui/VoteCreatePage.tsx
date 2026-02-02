import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import styles from './VoteCreatePage.module.css'
import { createVote } from '@/entities/vote'
import { navigate } from '@/shared/lib/navigation'
import { request } from '@/shared/lib/api'

type LoadState = 'loading' | 'success' | 'error'
type VoteStatus = 'GENERATING' | 'OPEN' | 'COUNTING' | 'COUNTED' | 'FAILED' | 'UNKNOWN' | null

type MeetingDetailStateResponse = {
  voteStatus: VoteStatus
}

export function VoteCreatePage() {
  const { search } = useLocation()
  const [status, setStatus] = useState<LoadState>('loading')
  const [error, setError] = useState<string | null>(null)
  const [voteId, setVoteId] = useState<number | null>(null)
  const pollTimerRef = useRef<number | null>(null)
  const pollVoteStatusRef = useRef<() => void>(() => {})

  const meetingId = useMemo(() => {
    const params = new URLSearchParams(search)
    const raw = params.get('meetingId')
    const parsed = raw ? Number(raw) : Number.NaN
    return Number.isFinite(parsed) ? parsed : null
  }, [search])

  const goBack = useCallback(() => {
    if (meetingId) {
      navigate(`/meetings/${meetingId}`)
      return
    }
    navigate('/main')
  }, [meetingId])

  const handleCreate = useCallback(async () => {
    if (!meetingId) {
      setStatus('error')
      setError('모임 정보를 찾을 수 없습니다.')
      return
    }

    setStatus('loading')
    setError(null)

    try {
      const response = await createVote(meetingId)
      setVoteId(response.voteId)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : '투표 생성에 실패했습니다. 다시 시도해주세요.'
      setError(message)
      setStatus('error')
    }
  }, [meetingId])

  const handleStartVote = useCallback(() => {
    if (!meetingId || !voteId) return
    navigate(`/meetings/${meetingId}/votes/${voteId}`)
  }, [meetingId, voteId])

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      window.clearTimeout(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }, [])

  const pollVoteStatus = useCallback(async () => {
    if (!meetingId) return
    try {
      const state = await request<MeetingDetailStateResponse>(
        `/api/v1/meetings/${meetingId}/state`,
      )
      const nextStatus = state.voteStatus ?? 'UNKNOWN'

      if (nextStatus === 'OPEN') {
        setStatus('success')
        stopPolling()
        return
      }

      if (nextStatus === 'FAILED') {
        setStatus('error')
        setError('투표 생성에 실패했습니다. 검색 반경을 넓혀 다시 시도해주세요.')
        stopPolling()
        return
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '투표 상태를 불러오지 못했습니다.')
    }

    pollTimerRef.current = window.setTimeout(() => {
      pollVoteStatusRef.current()
    }, 1500)
  }, [meetingId, stopPolling])

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void handleCreate()
    }, 0)
    return () => window.clearTimeout(timerId)
  }, [handleCreate])

  useEffect(() => {
    pollVoteStatusRef.current = pollVoteStatus
  }, [pollVoteStatus])

  useEffect(() => {
    if (!meetingId || status === 'error') return
    if (status === 'success') return
    stopPolling()
    pollTimerRef.current = window.setTimeout(() => {
      pollVoteStatusRef.current()
    }, 1500)
    return () => stopPolling()
  }, [meetingId, pollVoteStatus, status, stopPolling])

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button
          type="button"
          className={styles.backButton}
          onClick={goBack}
          aria-label="모임 상세로 돌아가기"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className={styles.title}>투표 생성</h1>
      </header>

      <section className={styles.card}>
        {status === 'loading' && (
          <div className={styles.state}>
            <p className={styles.stateTitle}>투표를 생성하고 있어요.</p>
            <p className={styles.stateText}>잠시만 기다려주세요.</p>
          </div>
        )}

        {status === 'success' && (
          <div className={styles.stateSuccess}>
            <p className={styles.stateTitle}>투표가 생성되었습니다.</p>
            <p className={styles.stateText}>지금 바로 투표를 시작할 수 있어요.</p>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={handleStartVote}
                disabled={!voteId}
              >
                투표 시작하기
              </button>
              <button type="button" className={styles.secondaryButton} onClick={goBack}>
                모임 상세로 돌아가기
              </button>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className={styles.stateError}>
            <p className={styles.stateTitle}>투표 생성에 실패했습니다.</p>
            <p className={styles.stateText}>
              {error ?? '다시 시도해주세요.'}
            </p>
            <div className={styles.actions}>
              <button type="button" className={styles.primaryButton} onClick={handleCreate}>
                다시 시도하기
              </button>
              <button type="button" className={styles.secondaryButton} onClick={goBack}>
                모임 상세로 돌아가기
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
