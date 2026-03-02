import { request } from '@/shared/lib/api'
import type {
  CreateReviewRequest,
  CreateReviewResponse,
  ReviewDetail,
  ReviewListResponse,
  UpdateReviewRequest,
} from './types'

export async function createMeetingReview(
  meetingId: number,
  payload: CreateReviewRequest,
) {
  return request<CreateReviewResponse>(`/api/v1/meetings/${meetingId}/reviews`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function getMyReviews(cursor?: number | null, size = 10) {
  const query = new URLSearchParams()
  query.set('size', String(size))
  if (cursor !== undefined && cursor !== null) {
    query.set('cursor', String(cursor))
  }
  return request<ReviewListResponse>(`/api/v1/member/me/reviews?${query.toString()}`)
}

export async function getReview(reviewId: number) {
  return request<ReviewDetail>(`/api/v1/reviews/${reviewId}`)
}

export async function updateReview(reviewId: number, payload: UpdateReviewRequest) {
  return request<ReviewDetail>(`/api/v1/reviews/${reviewId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function deleteReview(reviewId: number) {
  return request<void>(`/api/v1/reviews/${reviewId}`, {
    method: 'DELETE',
  })
}
