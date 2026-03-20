import { useCallback, useEffect, useRef, useState } from 'react'
import styles from './EventPage.module.css'
import {
  createEventIssueRequest,
  getEvents,
  getMyEventIssueRequestStatus,
  type EventIssueRequestReason,
  type EventIssueStatusResponse,
  type EventItem,
  type EventProgressStatus,
} from '@/entities/event'
import { BottomNav } from '@/shared/ui/bottom-nav'

type LoadState = 'idle' | 'loading' | 'success' | 'error'
type ToastType = 'success' | 'error'

function formatDateTime(value: string | null) {
  if (!value) return '-'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date)
}

function getProgressLabel(status: EventProgressStatus) {
  if (status === 'SCHEDULED') return '오픈 예정'
  if (status === 'IN_PROGRESS') return '진행중'
  if (status === 'SOLD_OUT') return '마감/소진'
  return '종료'
}

function getIssueFailureMessage(reason: EventIssueRequestReason | null) {
  if (reason === 'ALREADY_WAITING') return '이미 진행 중인 발급 요청이 있어요. 이어서 상태를 확인합니다.'
  if (reason === 'ALREADY_ISSUED') return '이미 발급된 쿠폰이 있어요.'
  if (reason === 'EVENT_NOT_STARTED') return '아직 오픈 전인 이벤트예요.'
  if (reason === 'QUEUE_LIMIT_EXCEEDED' || reason === 'SOLD_OUT') return '현재 마감된 이벤트예요.'
  if (reason === 'EVENT_ENDED') return '종료된 이벤트예요.'
  return '쿠폰 발급에 실패했어요. 잠시 후 다시 시도해 주세요.'
}

export function EventPage() {
  const [eventsState, setEventsState] = useState<LoadState>('idle')
  const [events, setEvents] = useState<EventItem[]>([])
  const [eventsError, setEventsError] = useState<string | null>(null)

  const [issuingEventId, setIssuingEventId] = useState<number | null>(null)
  const [activeIssueEventId, setActiveIssueEventId] = useState<number | null>(null)
  const [issueStatus, setIssueStatus] = useState<EventIssueStatusResponse | null>(null)
  const [pollingInterval, setPollingInterval] = useState(1000)
  const pollingTimeoutRef = useRef<number | null>(null)
  const toastTimeoutRef = useRef<number | null>(null)
  const [toast, setToast] = useState<{ type: ToastType; message: string } | null>(null)

  const showToast = (type: ToastType, message: string) => {
    setToast({ type, message })

    if (toastTimeoutRef.current !== null) {
      window.clearTimeout(toastTimeoutRef.current)
    }

    toastTimeoutRef.current = window.setTimeout(() => {
      setToast(null)
      toastTimeoutRef.current = null
    }, 2500)
  }

  const loadEvents = useCallback(async () => {
    setEventsState('loading')
    setEventsError(null)

    try {
      const response = await getEvents({ size: 20 })
      setEvents(response.items ?? [])
      setEventsState('success')
    } catch (error) {
      setEventsState('error')
      setEventsError(error instanceof Error ? error.message : '이벤트 목록을 불러오지 못했어요.')
    }
  }, [])

  useEffect(() => {
    void loadEvents()
  }, [loadEvents])

  useEffect(() => {
    return () => {
      if (pollingTimeoutRef.current !== null) {
        window.clearTimeout(pollingTimeoutRef.current)
      }
      if (toastTimeoutRef.current !== null) {
        window.clearTimeout(toastTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    let active = true

    const restorePendingIssue = async () => {
      for (const event of events) {
        try {
          const response = await getMyEventIssueRequestStatus(event.eventId)
          if (!active) return

          if (response.status === 'WAITING' || response.status === 'PROCESSING') {
            setActiveIssueEventId(event.eventId)
            setIssueStatus(response)
            setPollingInterval(1000)
            return
          }
        } catch {
          continue
        }
      }
    }

    if (events.length > 0 && activeIssueEventId === null && issueStatus === null) {
      void restorePendingIssue()
    }

    return () => {
      active = false
    }
  }, [activeIssueEventId, events, issueStatus])

  useEffect(() => {
    if (activeIssueEventId === null || issueStatus === null) return
    if (issueStatus.status !== 'WAITING' && issueStatus.status !== 'PROCESSING') return

    const interval = pollingInterval > 0 ? pollingInterval : 1000

    pollingTimeoutRef.current = window.setTimeout(async () => {
      try {
        const response = await getMyEventIssueRequestStatus(activeIssueEventId)
        setIssueStatus(response)

        if (response.status === 'SUCCEEDED') {
          showToast('success', '쿠폰이 발급되었어요.')
          void loadEvents()
          setActiveIssueEventId(null)
          setIssueStatus(null)
        } else if (response.status === 'FAILED') {
          showToast('error', getIssueFailureMessage(response.reason))
          void loadEvents()
          setActiveIssueEventId(null)
          setIssueStatus(null)
        }
      } catch (error) {
        showToast('error', error instanceof Error ? error.message : '발급 상태를 확인하지 못했어요.')
        setActiveIssueEventId(null)
        setIssueStatus(null)
      }
    }, interval)

    return () => {
      if (pollingTimeoutRef.current !== null) {
        window.clearTimeout(pollingTimeoutRef.current)
      }
    }
  }, [activeIssueEventId, issueStatus, loadEvents, pollingInterval])

  const handleIssue = async (event: EventItem) => {
    if (issuingEventId !== null) return

    setIssuingEventId(event.eventId)

    try {
      const response = await createEventIssueRequest(event.eventId)

      if (response.status === 'WAITING') {
        setPollingInterval(response.pollingIntervalMillis ?? 1000)
        setActiveIssueEventId(event.eventId)
        setIssueStatus({
          requestId: response.requestId,
          status: 'WAITING',
          reason: response.reason,
          queuePosition: response.queuePosition,
          couponId: null,
          issuedAt: null,
          expiredAt: null,
        })
        return
      }

      if (response.reason === 'ALREADY_WAITING') {
        setPollingInterval(response.pollingIntervalMillis ?? 1000)
        const statusResponse = await getMyEventIssueRequestStatus(event.eventId)
        setActiveIssueEventId(event.eventId)
        setIssueStatus(statusResponse)
        return
      }

      showToast('error', getIssueFailureMessage(response.reason))
      void loadEvents()
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : '쿠폰 발급 요청에 실패했어요.')
    } finally {
      setIssuingEventId(null)
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>이벤트</h1>
      </header>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>진행 중인 이벤트</h2>
          {eventsState === 'loading' ? <span className={styles.meta}>불러오는 중</span> : null}
        </div>

        {eventsError ? <p className={styles.note}>{eventsError}</p> : null}

        {eventsState === 'success' && events.length === 0 ? (
          <p className={styles.note}>표시할 이벤트가 없어요.</p>
        ) : null}

        <div className={styles.list}>
          {events.map((event) => {
            const isActiveIssue = activeIssueEventId === event.eventId && issueStatus !== null
            const disabled =
              issuingEventId !== null ||
              (activeIssueEventId !== null && activeIssueEventId !== event.eventId) ||
              event.progressStatus === 'SCHEDULED' ||
              event.progressStatus === 'SOLD_OUT' ||
              event.progressStatus === 'ENDED'

            return (
              <article key={event.eventId} className={styles.card}>
                <div className={styles.cardTop}>
                  <strong className={styles.cardTitle}>{event.title}</strong>
                  <span className={styles.badge}>{getProgressLabel(event.progressStatus)}</span>
                </div>
                <p className={styles.description}>{event.description}</p>
                <dl className={styles.metaList}>
                  <div>
                    <dt>시작</dt>
                    <dd>{formatDateTime(event.startAt)}</dd>
                  </div>
                  <div>
                    <dt>종료</dt>
                    <dd>{formatDateTime(event.endAt)}</dd>
                  </div>
                  <div>
                    <dt>잔여 수량</dt>
                    <dd>
                      {event.remainingCount} / {event.capacity}
                    </dd>
                  </div>
                </dl>
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={() => handleIssue(event)}
                  disabled={disabled}
                >
                  {issuingEventId === event.eventId
                    ? '요청 중...'
                    : isActiveIssue && issueStatus.status === 'WAITING'
                      ? '대기중...'
                      : isActiveIssue && issueStatus.status === 'PROCESSING'
                        ? '처리중...'
                        : '쿠폰 발급받기'}
                </button>
                {isActiveIssue && issueStatus.status === 'PROCESSING' ? (
                  <p className={styles.inlineStatus}>쿠폰 발급을 처리하고 있어요.</p>
                ) : null}
              </article>
            )
          })}
        </div>
      </section>

      {toast ? (
        <div
          className={`${styles.toast} ${
            toast.type === 'success' ? styles.toastSuccess : styles.toastError
          }`}
          role="status"
          aria-live="polite"
        >
          <p className={styles.toastMessage}>{toast.message}</p>
        </div>
      ) : null}

      <BottomNav />
    </div>
  )
}
