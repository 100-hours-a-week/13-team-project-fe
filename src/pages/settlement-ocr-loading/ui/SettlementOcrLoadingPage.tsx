import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import styles from './SettlementOcrLoadingPage.module.css'
import {
  getSettlementProgress,
  getSettlementProgressStreamUrl,
  type SettlementProgressResponse,
} from '@/entities/settlement'
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
    let eventSource: EventSource | null = null
    let pollingTimer: number | null = null

    const clearPolling = () => {
      if (pollingTimer !== null) {
        window.clearInterval(pollingTimer)
        pollingTimer = null
      }
    }

    const closeEventSource = () => {
      if (eventSource) {
        eventSource.close()
        eventSource = null
      }
    }

    const handleProgress = (progress: SettlementProgressResponse) => {
      if (!active) return false

      if (progress.settlementStatus === 'OCR_FAILED') {
        closeEventSource()
        clearPolling()
        setError(progress.error?.message ?? null)
        navigate(`/meetings/${parsedMeetingId}/settlement/ocr/failed`, { replace: true })
        return true
      }

      if (progress.settlementStatus === 'OCR_SUCCEEDED') {
        closeEventSource()
        clearPolling()
        navigate(`/meetings/${parsedMeetingId}/settlement/ocr/edit`, { replace: true })
        return true
      }

      return false
    }

    const pollProgress = async () => {
      try {
        const progress = await getSettlementProgress(parsedMeetingId)
        handleProgress(progress)
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err.message : 'OCR 진행 상태를 확인할 수 없어요.')
        clearPolling()
        void routeBySettlementState(parsedMeetingId, { replace: true })
      }
    }

    const startPollingFallback = () => {
      if (!active || pollingTimer !== null) return
      closeEventSource()
      void pollProgress()
      pollingTimer = window.setInterval(() => {
        void pollProgress()
      }, 1500)
    }

    if (typeof window === 'undefined' || typeof EventSource === 'undefined') {
      startPollingFallback()
    } else {
      try {
        eventSource = new EventSource(getSettlementProgressStreamUrl(parsedMeetingId), {
          withCredentials: true,
        })

        eventSource.addEventListener('settlement-progress', (event) => {
          if (!active) return
          try {
            const progress = JSON.parse((event as MessageEvent<string>).data) as SettlementProgressResponse
            setError(null)
            handleProgress(progress)
          } catch {
            startPollingFallback()
          }
        })

        eventSource.onerror = () => {
          if (!active) return
          startPollingFallback()
        }
      } catch {
        startPollingFallback()
      }
    }

    return () => {
      active = false
      closeEventSource()
      clearPolling()
    }
  }, [hasInvalidMeetingId, parsedMeetingId])

  return (
    <div className={styles.page} data-page-id="settlement-ocr-loading">
      <header className={styles.header}>
        <h1 className={styles.title}>OCR 진행 중</h1>
      </header>
      <div className={styles.loadingRow} aria-live="polite">
        <span className={styles.spinner} aria-hidden="true" />
        <span>
          영수증 인식 중
          <span className={styles.dots} aria-hidden="true" />
        </span>
      </div>
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
