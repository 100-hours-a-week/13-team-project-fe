import { useCallback, useEffect, useMemo, useRef, useState, type TouchEvent } from 'react'
import styles from './NotificationPage.module.css'
import {
  deleteNotification,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
} from '@/entities/notification'
import { BottomNav } from '@/shared/ui/bottom-nav'
import { navigate } from '@/shared/lib/navigation'

const PULL_TRIGGER_DISTANCE = 72
const PULL_MAX_DISTANCE = 108

function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

function resolveDeeplink(item: NotificationItem) {
  if (item.deeplinkPath && item.deeplinkPath.trim()) {
    return item.deeplinkPath
  }

  const targetId = item.targetId
  const subTargetId = item.subTargetId

  switch (item.targetType) {
    case 'MEETING':
      return targetId ? `/meetings/${targetId}` : '/notification'
    case 'VOTE':
      if (targetId && subTargetId) {
        return `/meetings/${targetId}/votes/${subTargetId}`
      }
      return targetId ? `/meetings/${targetId}` : '/notification'
    case 'SETTLEMENT':
      return targetId ? `/meetings/${targetId}/settlement/result` : '/notification'
    default:
      return '/notification'
  }
}

export function NotificationPage() {
  const [items, setItems] = useState<NotificationItem[]>([])
  const [cursorCreatedAt, setCursorCreatedAt] = useState<string | null>(null)
  const [cursorId, setCursorId] = useState<number | null>(null)
  const [hasNext, setHasNext] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [processingId, setProcessingId] = useState<number | null>(null)
  const [readAllLoading, setReadAllLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const touchStartYRef = useRef<number | null>(null)
  const isPullingRef = useRef(false)
  const pullDistanceRef = useRef(0)

  const unreadBadge = useMemo(() => {
    if (unreadCount <= 0) return '0'
    if (unreadCount > 99) return '99+'
    return String(unreadCount)
  }, [unreadCount])

  const loadInitial = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setLoading(true)
    } else {
      setRefreshing(true)
    }
    setError(null)

    try {
      const data = await getNotifications({ size: 20 })
      setItems(data.items ?? [])
      setCursorCreatedAt(data.nextCursorCreatedAt)
      setCursorId(data.nextCursorId)
      setHasNext(Boolean(data.hasNext))
      setUnreadCount(data.unreadCount ?? 0)
    } catch {
      setError('알림을 불러오지 못했어요.')
    } finally {
      if (showLoading) {
        setLoading(false)
      } else {
        setRefreshing(false)
      }
    }
  }, [])

  useEffect(() => {
    void loadInitial(true)
  }, [loadInitial])

  const isAtTop = () => window.scrollY <= 0 && document.documentElement.scrollTop <= 0

  const resetPullState = () => {
    touchStartYRef.current = null
    isPullingRef.current = false
    pullDistanceRef.current = 0
    setPullDistance(0)
  }

  const loadMore = async () => {
    if (!hasNext || loadingMore || !cursorCreatedAt || cursorId === null) return

    setLoadingMore(true)
    setError(null)
    try {
      const data = await getNotifications({
        cursorCreatedAt,
        cursorId,
        size: 20,
      })

      setItems((prev) => [...prev, ...(data.items ?? [])])
      setCursorCreatedAt(data.nextCursorCreatedAt)
      setCursorId(data.nextCursorId)
      setHasNext(Boolean(data.hasNext))
      setUnreadCount(data.unreadCount ?? 0)
    } catch {
      setError('알림을 더 불러오지 못했어요.')
    } finally {
      setLoadingMore(false)
    }
  }

  const handleRead = async (id: number) => {
    setProcessingId(id)
    setError(null)
    try {
      await markNotificationRead(id)
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, read: true } : item)))
      setUnreadCount((prev) => Math.max(0, prev - 1))
    } catch {
      setError('읽음 처리에 실패했어요.')
    } finally {
      setProcessingId(null)
    }
  }

  const handleReadAll = async () => {
    setReadAllLoading(true)
    setError(null)
    try {
      await markAllNotificationsRead()
      setItems((prev) => prev.map((item) => ({ ...item, read: true })))
      setUnreadCount(0)
    } catch {
      setError('전체 읽음 처리에 실패했어요.')
    } finally {
      setReadAllLoading(false)
    }
  }

  const handleDelete = async (id: number) => {
    setProcessingId(id)
    setError(null)
    try {
      await deleteNotification(id)
      setItems((prev) => prev.filter((item) => item.id !== id))
    } catch {
      setError('알림 삭제에 실패했어요.')
    } finally {
      setProcessingId(null)
    }
  }

  const handleItemClick = async (item: NotificationItem) => {
    if (!item.read) {
      await handleRead(item.id)
    }
    const path = resolveDeeplink(item)
    navigate(path)
  }

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    if (loading || refreshing || !isAtTop()) return
    touchStartYRef.current = event.touches[0]?.clientY ?? null
  }

  const handleTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    const startY = touchStartYRef.current
    if (startY === null) return

    const currentY = event.touches[0]?.clientY ?? startY
    const deltaY = currentY - startY

    if (deltaY <= 0) {
      if (isPullingRef.current) {
        isPullingRef.current = false
        pullDistanceRef.current = 0
        setPullDistance(0)
      }
      return
    }

    if (!isAtTop() && !isPullingRef.current) return

    isPullingRef.current = true
    const eased = Math.min(PULL_MAX_DISTANCE, deltaY * 0.45)
    pullDistanceRef.current = eased
    setPullDistance(eased)

    if (event.cancelable) event.preventDefault()
  }

  const handleTouchEnd = () => {
    const shouldRefresh =
      isPullingRef.current &&
      pullDistanceRef.current >= PULL_TRIGGER_DISTANCE &&
      !loading &&
      !refreshing

    resetPullState()

    if (shouldRefresh) {
      void loadInitial(false)
    }
  }

  return (
    <div
      className={styles.page}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <div
        className={styles.content}
        style={pullDistance > 0 ? { transform: `translateY(${pullDistance}px)` } : undefined}
      >
        <header className={styles.header}>
          <h1 className={styles.title}>알림</h1>
          <span className={styles.badge}>미읽음 {unreadBadge}</span>
        </header>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primaryButton}
            disabled={readAllLoading || unreadCount === 0 || refreshing}
            onClick={() => void handleReadAll()}
          >
            {readAllLoading ? '처리 중...' : '전체 읽음'}
          </button>
        </div>

        {error ? <p className={styles.error}>{error}</p> : null}

        {loading ? (
          <p className={styles.placeholder}>알림을 불러오는 중...</p>
        ) : items.length === 0 ? (
          <p className={styles.placeholder}>아직 도착한 알림이 없어요.</p>
        ) : (
          <ul className={styles.list}>
            {items.map((item) => (
              <li
                key={item.id}
                className={item.read ? styles.itemRead : styles.itemUnread}
                onClick={() => void handleItemClick(item)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    void handleItemClick(item)
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <div className={styles.itemHead}>
                  <strong className={styles.itemTitle}>{item.title}</strong>
                  <time className={styles.itemTime}>{formatDateTime(item.createdAt)}</time>
                </div>
                <p className={styles.itemContent}>{item.content}</p>
                <div className={styles.itemActions}>
                  <button
                    type="button"
                    className={styles.inlineButton}
                    disabled={item.read || processingId === item.id}
                    onClick={(event) => {
                      event.stopPropagation()
                      void handleRead(item.id)
                    }}
                  >
                    읽음
                  </button>
                  <button
                    type="button"
                    className={styles.inlineButton}
                    disabled={processingId === item.id}
                    onClick={(event) => {
                      event.stopPropagation()
                      void handleDelete(item.id)
                    }}
                  >
                    삭제
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {hasNext ? (
          <button
            type="button"
            className={styles.moreButton}
            disabled={loadingMore}
            onClick={() => void loadMore()}
          >
            {loadingMore ? '불러오는 중...' : '더 보기'}
          </button>
        ) : null}
      </div>

      <BottomNav />
    </div>
  )
}
