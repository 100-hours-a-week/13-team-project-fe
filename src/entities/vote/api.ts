import { request } from '@/shared/api/httpClient'
import type {
  CreateVoteResponse,
  FinalSelectionRequest,
  FinalSelectionResponse,
  VoteCandidatesResponse,
  VoteResultsResponse,
  VoteSubmitRequest,
  VoteStatusResponse,
} from './types'

export async function getVoteCandidates(meetingId: number, voteId: number) {
  return request<VoteCandidatesResponse>(
    `/api/v1/meetings/${meetingId}/votes/${voteId}/candidates`,
  )
}

export async function submitVote(
  meetingId: number,
  voteId: number,
  payload: VoteSubmitRequest,
) {
  return request<void>(`/api/v1/meetings/${meetingId}/votes/${voteId}/submissions`, {
    method: 'POST',
    body: payload,
  })
}

export async function getVoteStatus(meetingId: number, voteId: number) {
  return request<VoteStatusResponse>(
    `/api/v1/meetings/${meetingId}/votes/${voteId}/status`,
  )
}

export async function createVote(meetingId: number) {
  return request<CreateVoteResponse>(`/api/v1/meetings/${meetingId}/votes`, {
    method: 'POST',
  })
}

export async function getVoteResults(meetingId: number, voteId: number) {
  return request<VoteResultsResponse>(
    `/api/v1/meetings/${meetingId}/votes/${voteId}/results`,
  )
}

export async function finalizeSelection(
  meetingId: number,
  voteId: number,
  payload: FinalSelectionRequest,
) {
  return request<void>(
    `/api/v1/meetings/${meetingId}/votes/${voteId}/final-selection`,
    {
      method: 'POST',
      body: payload,
    },
  )
}

export async function getFinalSelection(meetingId: number) {
  return request<FinalSelectionResponse>(
    `/api/v1/meetings/${meetingId}/final-selection`,
  )
}
