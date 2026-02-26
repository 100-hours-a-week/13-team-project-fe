import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import styles from './SettlementWaitingPage.module.css'
import { getSettlementWaiting } from '@/entities/settlement'
import { navigate } from '@/shared/lib/navigation'
import { routeBySettlementState } from '@/shared/lib/settlement'

export function SettlementWaitingPage() {
  const { meetingId } = useParams()
  const parsedMeetingId = Number(meetingId)
  const hasInvalidMeetingId = !Number.isFinite(parsedMeetingId)
  const [confirmedCount, setConfirmedCount] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (hasInvalidMeetingId) return

    let active = true
    const timer = window.setInterval(async () => {
      try {
        const waiting = await getSettlementWaiting(parsedMeetingId)
        if (!active) return
        setConfirmedCount(waiting.confirmedCount)
        setTotalCount(waiting.totalCount)
        if (waiting.settlementStatus === 'RESULT_READY') {
          navigate(`/meetings/${parsedMeetingId}/settlement/result`, { replace: true })
          return
        }
        if (waiting.settlementStatus === 'COMPLETED') {
          navigate(`/meetings/${parsedMeetingId}/settlement/completed`, { replace: true })
        }
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err.message : '정산 상태를 확인할 수 없어요.')
        void routeBySettlementState(parsedMeetingId, { replace: true })
      }
    }, 1500)

    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [hasInvalidMeetingId, parsedMeetingId])

  return (
    <div className={styles.page} data-page-id="settlement-waiting">
      <header className={styles.header}>
        <h1 className={styles.title}>정산 집계 중</h1>
      </header>
      <p className={styles.description}>모든 참여자의 정산 계산 요청을 기다리고 있어요.</p>
      <section className={styles.card}>
        <span>확정 인원</span>
        <strong>
          {confirmedCount}/{totalCount}
        </strong>
      </section>
      {hasInvalidMeetingId && <p className={styles.note}>모임 정보를 찾을 수 없어요.</p>}
      {error && <p className={styles.note}>{error}</p>}
      <button
        type="button"
        className={styles.linkButton}
        onClick={() => navigate(`/meetings/${parsedMeetingId}`)}
      >
        모임 상세로 이동
      </button>
    </div>
  )
}
