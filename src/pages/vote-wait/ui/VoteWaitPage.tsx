import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import styles from './VoteWaitPage.module.css'
import { getVoteStatus, type VoteStatusResponse } from '@/entities/vote'
import { navigate } from '@/shared/lib/navigation'

export function VoteWaitPage() {
  const { meetingId, voteId } = useParams()
  const parsedMeetingId = Number(meetingId)
  const parsedVoteId = Number(voteId)
  const [status, setStatus] = useState<VoteStatusResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!Number.isFinite(parsedMeetingId) || !Number.isFinite(parsedVoteId)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError('대기 정보를 불러올 수 없어요.')
      setLoading(false)
      return
    }

    let active = true
    let timerId: number | null = null

    const fetchStatus = async () => {
      try {
        if (!active) return
        setError(null)
        const response = await getVoteStatus(parsedMeetingId, parsedVoteId)
        if (!active) return
        setStatus({
          ...response,
          voteStatus: response.voteStatus ?? 'UNKNOWN',
        })
        setLoading(false)
        if (response.voteStatus === 'COUNTED') {
          navigate(`/meetings/${parsedMeetingId}/votes/${parsedVoteId}/top3`)
        }
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err.message : '투표 상태를 불러오지 못했어요.')
        setLoading(false)
      }
    }

    void fetchStatus()
    timerId = window.setInterval(fetchStatus, 3000)

    return () => {
      active = false
      if (timerId) window.clearInterval(timerId)
    }
  }, [parsedMeetingId, parsedVoteId])

  const submittedCount = status?.submittedCount ?? 0
  const totalCount = status?.totalCount ?? 0

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>투표 대기</h1>
      </header>

      {loading && <p className={styles.note}>상태를 확인하는 중...</p>}
      {error && <p className={styles.note}>{error}</p>}

      {!loading && !error && (
        <section className={styles.statusCard}>
          <div className={styles.counts}>
            <span className={styles.countLabel}>현재 투표</span>
            <strong className={styles.countValue}>
              {submittedCount}/{totalCount}
            </strong>
          </div>
          {status?.voteStatus === 'COUNTING' && (
            <p className={styles.countingText}>결과를 집계 중이에요...</p>
          )}
          <p className={styles.helperText}>
            모든 인원이 투표를 완료하면 결과 화면으로 이동해요.
          </p>
        </section>
      )}

      <button
        type="button"
        className={styles.detailButton}
        onClick={() => navigate(`/meetings/${parsedMeetingId}`)}
      >
        모임 상세로 이동
      </button>
    </div>
  )
}
