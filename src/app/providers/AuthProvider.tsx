import { type PropsWithChildren, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ApiError, getMemberMe, initCsrfToken, type MemberProfile } from '@/shared/lib/api'
import { AuthContext, type AuthContextValue } from '@/app/providers/auth-context'
import { upsertNotificationToken } from '@/entities/notification'
import { listenForegroundMessage } from '@/shared/lib/notification/firebase'
import { upsertBrowserNotificationToken } from '@/shared/lib/notification/token'
import { navigate } from '@/shared/lib/navigation'
import styles from './AuthProvider.module.css'

type ForegroundToast = {
  id: number
  title: string
  body: string
  deeplinkPath: string
}

function toText(value: string | null | undefined, fallback: string) {
  const normalized = typeof value === 'string' ? value.trim() : ''
  return normalized || fallback
}

function toPath(path: string | null | undefined) {
  if (!path) return '/notification'
  const normalized = path.trim()
  if (!normalized) return '/notification'
  return normalized.startsWith('/') ? normalized : `/${normalized}`
}

function resolveDeeplinkPath(data: Record<string, string>) {
  if (data.deeplinkPath) {
    return toPath(data.deeplinkPath)
  }

  const targetType = data.targetType
  const targetId = data.targetId
  const subTargetId = data.subTargetId

  switch (targetType) {
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

function getChatMeetingIdFromPath(path: string) {
  const matched = path.match(/^\/meetings\/(\d+)\/chat(?:\/|$)/)
  return matched?.[1] ?? null
}

function getMeetingIdFromChatPayload(data: Record<string, string>, deeplinkPath: string) {
  if (data.targetId && data.targetId.trim()) {
    return data.targetId.trim()
  }
  return getChatMeetingIdFromPath(deeplinkPath)
}

function shouldSuppressChatAlert(data: Record<string, string>, deeplinkPath: string, pathname: string) {
  if (data.notiType !== 'CHAT_MESSAGE') return false

  const currentMeetingId = getChatMeetingIdFromPath(pathname)
  if (!currentMeetingId) return false

  const targetMeetingId = getMeetingIdFromChatPayload(data, deeplinkPath)
  if (!targetMeetingId) return false

  return currentMeetingId === targetMeetingId
}

function showBrowserFallbackNotification(title: string, body: string, deeplinkPath: string) {
  if (typeof window === 'undefined') return
  if (!('Notification' in window)) return
  if (Notification.permission !== 'granted') return

  try {
    const browserNotification = new Notification(title, {
      body,
      data: { deeplinkPath },
      tag: `moyeobab-foreground-${Date.now()}`,
    })
    browserNotification.onclick = () => {
      window.focus()
      navigate(deeplinkPath)
      browserNotification.close()
    }
  } catch {
    // Ignore browser-specific Notification API failures.
  }
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [member, setMember] = useState<MemberProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<ForegroundToast | null>(null)
  const toastTimerRef = useRef<number | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const profile = await getMemberMe()
      setMember(profile)
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        setMember(null)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  const hideToast = useCallback(() => {
    setToast(null)
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current)
      toastTimerRef.current = null
    }
  }, [])

  const showToast = useCallback(
    (nextToast: Omit<ForegroundToast, 'id'>) => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current)
      }

      setToast({
        id: Date.now(),
        ...nextToast,
      })

      toastTimerRef.current = window.setTimeout(() => {
        setToast(null)
        toastTimerRef.current = null
      }, 4200)
    },
    [],
  )

  useEffect(() => {
    initCsrfToken().catch(() => {})
    refresh()
  }, [refresh])

  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!member || member.status !== 'ACTIVE') return
    upsertBrowserNotificationToken(upsertNotificationToken).catch(() => {})
  }, [member])

  useEffect(() => {
    if (!member || member.status !== 'ACTIVE') return

    let mounted = true
    let unsubscribe: (() => void) | null = null

    listenForegroundMessage((payload) => {
      const data = payload.data ?? {}
      const deeplinkPath = resolveDeeplinkPath(data)
      const pathname = window.location.pathname

      if (shouldSuppressChatAlert(data, deeplinkPath, pathname)) {
        return
      }

      const title = toText(payload.notification?.title ?? data.title, '알림')
      const body = toText(payload.notification?.body ?? data.content, '새로운 알림이 도착했어요.')

      if (document.visibilityState !== 'visible' || !document.hasFocus()) {
        showBrowserFallbackNotification(title, body, deeplinkPath)
        return
      }

      showToast({
        title,
        body,
        deeplinkPath,
      })
    })
      .then((off) => {
        if (!mounted) {
          off()
          return
        }
        unsubscribe = off
      })
      .catch(() => {})

    return () => {
      mounted = false
      if (unsubscribe) {
        unsubscribe()
      }
    }
  }, [member, showToast])

  const handleToastClick = useCallback(() => {
    if (!toast) return
    navigate(toast.deeplinkPath)
    hideToast()
  }, [hideToast, toast])

  const value = useMemo<AuthContextValue>(
    () => ({
      member,
      status: member?.status ?? null,
      loading,
      refresh,
      setMember,
    }),
    [member, loading, refresh],
  )

  return (
    <AuthContext.Provider value={value}>
      {children}
      {toast ? (
        <div className={styles.toastWrap} role="status" aria-live="polite">
          <button type="button" className={styles.toastCard} onClick={handleToastClick}>
            <strong className={styles.toastTitle}>{toast.title}</strong>
            <p className={styles.toastBody}>{toast.body}</p>
          </button>
          <button
            type="button"
            className={styles.toastClose}
            onClick={hideToast}
            aria-label="알림 토스트 닫기"
          >
            닫기
          </button>
        </div>
      ) : null}
    </AuthContext.Provider>
  )
}
