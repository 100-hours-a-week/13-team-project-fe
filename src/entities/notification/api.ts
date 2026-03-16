import { request } from '@/shared/lib/api'
import type {
  NotificationListResponse,
  NotificationReadAllResult,
  NotificationTokenDeactivatePayload,
  NotificationTokenUpsertPayload,
} from './types'

type GetNotificationsParams = {
  cursorCreatedAt?: string | null
  cursorId?: number | null
  size?: number
}

export async function getNotifications(params: GetNotificationsParams = {}) {
  const query = new URLSearchParams()
  const size = params.size ?? 20
  query.set('size', String(size))

  if (params.cursorCreatedAt && params.cursorId !== null && params.cursorId !== undefined) {
    query.set('cursorCreatedAt', params.cursorCreatedAt)
    query.set('cursorId', String(params.cursorId))
  }

  return request<NotificationListResponse>(`/api/v1/notifications?${query.toString()}`)
}

export async function markNotificationRead(notificationId: number) {
  return request('/api/v1/notifications/' + notificationId + '/read', {
    method: 'PATCH',
  })
}

export async function markAllNotificationsRead() {
  return request<NotificationReadAllResult>('/api/v1/notifications/read-all', {
    method: 'PATCH',
  })
}

export async function deleteNotification(notificationId: number) {
  return request('/api/v1/notifications/' + notificationId, {
    method: 'DELETE',
  })
}

export async function upsertNotificationToken(payload: NotificationTokenUpsertPayload) {
  return request('/api/v1/notifications/tokens', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function deactivateNotificationToken(payload: NotificationTokenDeactivatePayload) {
  return request('/api/v1/notifications/tokens/deactivate', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
