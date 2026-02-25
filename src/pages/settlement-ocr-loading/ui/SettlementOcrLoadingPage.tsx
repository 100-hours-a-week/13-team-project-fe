import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import styles from './SettlementOcrLoadingPage.module.css'
import { getSettlementProgress } from '@/entities/settlement'
import { navigate } from '@/shared/lib/navigation'
import { routeBySettlementState } from '@/shared/lib/settlement'

export function SettlementOcrLoadingPage() {
  const { meetingId } = useParams()
  const parsedMeetingId = Number(meetingId)
  const hasInvalidMeetingId = !Number.isFinite(parsedMeetingId)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (hasInvalidMeetingId) return

    let active = true
    const timer = window.setInterval(async () => {
      try {
        const progress = await getSettlementProgress(parsedMeetingId)
        if (!active) return
        if (progress.settlementStatus === 'OCR_FAILED') {
          navigate(`/meetings/${parsedMeetingId}/settlement/ocr/failed`, { replace: true })
          return
        }
        if (progress.settlementStatus === 'OCR_SUCCEEDED') {
          navigate(`/meetings/${parsedMeetingId}/settlement/ocr/edit`, { replace: true })
        }
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err.message : 'OCR 진행 상태를 확인할 수 없어요.')
        void routeBySettlementState(parsedMeetingId, { replace: true })
      }
    }, 1500)

    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [hasInvalidMeetingId, parsedMeetingId])

  return (
    <div className={styles.page} data-page-id="settlement-ocr-loading">
      <header className={styles.header}>
        <h1 className={styles.title}>OCR 진행 중</h1>
      </header>
      <p className={styles.description}>영수증 인식이 끝나면 다음 단계로 자동 이동해요.</p>
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
