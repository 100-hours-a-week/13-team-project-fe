export type EventProgressStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'SOLD_OUT' | 'ENDED'

export type CouponType = 'SUPER_LIKE' | string

export type EventItem = {
  eventId: number
  title: string
  description: string
  couponType: CouponType
  progressStatus: EventProgressStatus
  startAt: string
  endAt: string
  capacity: number
  issuedCount: number
  remainingCount: number
}

export type CursorPage<T> = {
  items: T[]
  hasNext: boolean
  nextCursorCreatedAt: string | null
  nextCursorId: number | null
}

export type MyCouponStatus = 'ISSUED' | 'USED' | 'EXPIRED'

export type MyCouponItem = {
  couponId: number
  couponName: string
  couponType: CouponType
  eventId: number
  eventTitle: string
  issuedAt: string
  expiredAt: string
  usedAt: string | null
  status: MyCouponStatus
  usable: boolean
}

export type EventIssueRequestStatus = 'WAITING' | 'FAILED'

export type EventIssueRequestReason =
  | 'EVENT_NOT_STARTED'
  | 'EVENT_ENDED'
  | 'ALREADY_ISSUED'
  | 'ALREADY_WAITING'
  | 'QUEUE_LIMIT_EXCEEDED'
  | 'SOLD_OUT'
  | 'SYSTEM_ERROR'
  | string

export type EventIssueRequestResponse = {
  requestId: string
  status: EventIssueRequestStatus
  reason: EventIssueRequestReason | null
  queuePosition: number | null
  pollingIntervalMillis: number | null
}

export type EventIssuePollingStatus = 'WAITING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED'

export type EventIssueStatusResponse = {
  requestId: string
  status: EventIssuePollingStatus
  reason: EventIssueRequestReason | null
  queuePosition: number | null
  couponId: number | null
  issuedAt: string | null
  expiredAt: string | null
}

export type EventListParams = {
  cursorCreatedAt?: string
  cursorId?: number
  size?: number
}
