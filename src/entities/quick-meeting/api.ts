import { request } from '@/shared/lib/api'
import type {
  QuickMeetingDetailResponse,
  QuickMeetingEnterRequest,
  QuickMeetingEnterResponse,
  QuickVoteCandidatesResponse,
  QuickVoteResultsResponse,
  QuickVoteStatusResponse,
  QuickVoteSubmitRequest,
} from './types'

export async function getQuickMeetingDetail(inviteCode: string) {
  return request<QuickMeetingDetailResponse>(`/api/v1/quick-meetings/${inviteCode}`)
}

export async function enterQuickMeeting(payload: QuickMeetingEnterRequest) {
  return request<QuickMeetingEnterResponse>('/api/v1/quick-meetings/enter', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function getQuickVoteCandidates(meetingId: number, voteId: number) {
  return request<QuickVoteCandidatesResponse>(
    `/api/v1/quick-meetings/${meetingId}/votes/${voteId}/candidates`,
  )
}

export async function submitQuickVote(
  meetingId: number,
  voteId: number,
  payload: QuickVoteSubmitRequest,
) {
  return request<void>(`/api/v1/quick-meetings/${meetingId}/votes/${voteId}/submissions`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function getQuickVoteStatus(meetingId: number, voteId: number) {
  return request<QuickVoteStatusResponse>(
    `/api/v1/quick-meetings/${meetingId}/votes/${voteId}/status`,
  )
}

export async function getQuickVoteResults(meetingId: number, voteId: number) {
  return request<QuickVoteResultsResponse>(
    `/api/v1/quick-meetings/${meetingId}/votes/${voteId}/results`,
  )
}

export async function regenerateQuickVote(meetingId: number) {
  return request<void>(`/api/v1/meetings/${meetingId}/votes`, {
    method: 'POST',
  })
}
