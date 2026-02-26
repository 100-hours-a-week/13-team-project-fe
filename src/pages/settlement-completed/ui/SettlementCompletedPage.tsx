import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import styles from './SettlementCompletedPage.module.css'
import { getSettlementCompleted } from '@/entities/settlement'
import { navigate } from '@/shared/lib/navigation'
import { routeBySettlementState } from '@/shared/lib/settlement'

export function SettlementCompletedPage() {
  const { meetingId } = useParams()
  const parsedMeetingId = Number(meetingId)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!Number.isFinite(parsedMeetingId)) {
      setError('모임 정보를 찾을 수 없어요.')
      setLoading(false)
      return
    }

    let active = true
    const checkCompleted = async () => {
      try {
        setLoading(true)
        setError(null)
        await getSettlementCompleted(parsedMeetingId)
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err.message : '완료 상태를 확인할 수 없어요.')
        void routeBySettlementState(parsedMeetingId, { replace: true })
      } finally {
        if (active) setLoading(false)
      }
    }

    void checkCompleted()
    return () => {
      active = false
    }
  }, [parsedMeetingId])

  return (
    <div className={styles.page} data-page-id="settlement-completed">
      <header className={styles.header}>
        <h1 className={styles.title}>정산 완료</h1>
      </header>

      {loading ? (
        <p className={styles.description}>완료 상태를 확인하는 중...</p>
      ) : (
        <p className={styles.description}>모든 정산이 완료되었어요.</p>
      )}
      {error && <p className={styles.note}>{error}</p>}

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={() => navigate(`/meetings/${parsedMeetingId}/reviews`)}
        >
          리뷰 작성하기
        </button>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={() => navigate('/main')}
        >
          홈으로 돌아가기
        </button>
      </div>
    </div>
  )
}
