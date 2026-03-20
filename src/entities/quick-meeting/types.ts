import type { VoteChoice } from '@/entities/vote'

export type QuickVoteStatus =
  | 'OPEN'
  | 'GENERATING'
  | 'RESERVED'
  | 'COUNTING'
  | 'COUNTED'
  | 'FAILED'
  | 'CLOSED'
  | 'UNKNOWN'

export type QuickMeetingEnterRequest = {
  inviteCode: string
  guestUuid?: string
}

export type QuickMeetingDetailResponse = {
  meetingId: number
  inviteCode: string
  locationAddress: string
  participantCount: number
  targetHeadcount: number
  voteDeadlineAt: string
  currentVoteId: number | null
  voteStatus: QuickVoteStatus
  hostMemberId?: number | null
}

export type QuickMeetingEnterResponse = {
  meetingId: number
  voteDeadlineAt: string
  guestUuid?: string | null
}

export type QuickVoteCandidate = {
  candidateId: number
  restaurantName: string
  imageUrl1: string | null
  imageUrl2: string | null
  imageUrl3: string | null
  distanceM: number
  rating: number
  categoryName: string
  roadAddress: string
  jibunAddress: string
}

export type QuickVoteCandidatesResponse = {
  availableSuperLikeCouponCount: number
  candidates: QuickVoteCandidate[]
}

export type QuickVoteSubmitItem = {
  candidateId: number
  choice: VoteChoice
  useCoupon: boolean
}

export type QuickVoteSubmitRequest = {
  items: QuickVoteSubmitItem[]
}

export type QuickVoteStatusResponse = {
  voteStatus: QuickVoteStatus
  submittedCount: number
  totalCount: number
}

export type QuickVoteResultItem = {
  candidateId: number
  rank: number
  restaurantName: string
  imageUrl1: string | null
  categoryName: string
  rating: number
  likeCount: number
  distanceM: number
  roadAddress: string
  jibunAddress: string
}

export type QuickVoteResultsResponse = {
  items: QuickVoteResultItem[]
  hostMemberId: number
}
