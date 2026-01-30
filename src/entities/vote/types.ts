export type VoteChoice = 'LIKE' | 'DISLIKE' | 'NEUTRAL'

export type VoteCandidate = {
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

export type VoteCandidatesResponse = {
  candidates: VoteCandidate[]
}

export type VoteSubmitItem = {
  candidateId: number
  choice: VoteChoice
}

export type VoteSubmitRequest = {
  items: VoteSubmitItem[]
}

export type VoteStatus = 'COUNTING' | 'COUNTED' | 'IN_PROGRESS' | 'COMPLETED' | 'READY' | 'UNKNOWN'

export type VoteStatusResponse = {
  voteStatus: VoteStatus
  submittedCount: number
  totalCount: number
}

export type CreateVoteResponse = {
  voteId: number
}

export type VoteResultsItem = {
  candidateId: number
  rank: number
  restaurantName: string
  imageUrl1: string
  categoryName: string
  rating: number
  likeCount: number
  distanceM: number
  roadAddress: string
  jibunAddress: string
}

export type VoteResultsResponse = {
  items: VoteResultsItem[]
}

export type FinalSelectionRequest = {
  candidateId: number
}

export type FinalSelectionResponse = {
  candidateId: number
  restaurantId: number
  restaurantName: string
  imageUrl1: string | null
  imageUrl2: string | null
  imageUrl3: string | null
  categoryName: string
  rating: number
  distanceM: number
  roadAddress: string
  jibunAddress: string
}
