import { request } from '@/shared/lib/api'
import type {
  CursorPage,
  EventIssueRequestResponse,
  EventIssueStatusResponse,
  EventItem,
  EventListParams,
  MyCouponItem,
} from './types'

function buildQuery(params: EventListParams = {}) {
  const searchParams = new URLSearchParams()

  if (params.cursorCreatedAt) {
    searchParams.set('cursorCreatedAt', params.cursorCreatedAt)
  }

  if (typeof params.cursorId === 'number') {
    searchParams.set('cursorId', String(params.cursorId))
  }

  if (typeof params.size === 'number') {
    searchParams.set('size', String(params.size))
  }

  const query = searchParams.toString()
  return query ? `?${query}` : ''
}

export async function getEvents(params?: EventListParams) {
  return request<CursorPage<EventItem>>(`/api/v1/events${buildQuery(params)}`)
}

export async function getMyCoupons(params?: EventListParams) {
  return request<CursorPage<MyCouponItem>>(`/api/v1/member/me/coupons${buildQuery(params)}`)
}

export async function createEventIssueRequest(eventId: number) {
  return request<EventIssueRequestResponse>(`/api/v1/events/${eventId}/issue-requests`, {
    method: 'POST',
  })
}

export async function getMyEventIssueRequestStatus(eventId: number) {
  return request<EventIssueStatusResponse>(`/api/v1/events/${eventId}/issue-requests/me`)
}
