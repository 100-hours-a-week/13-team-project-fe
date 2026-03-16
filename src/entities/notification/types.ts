export type NotificationItem = {
  id: number
  notiType: string
  title: string
  content: string
  targetType: string
  targetId: number | null
  subTargetId: number | null
  deeplinkPath: string | null
  payloadJson: string | null
  readAt: string | null
  createdAt: string
  read: boolean
}

export type NotificationListResponse = {
  items: NotificationItem[]
  nextCursorCreatedAt: string | null
  nextCursorId: number | null
  hasNext: boolean
  unreadCount: number
}

export type NotificationReadAllResult = {
  updatedCount: number
}

export type NotificationTokenUpsertPayload = {
  fcmToken: string
  deviceKey?: string
  userAgent?: string
}

export type NotificationTokenDeactivatePayload = {
  fcmToken: string
}
