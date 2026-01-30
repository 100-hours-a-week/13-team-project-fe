export type ParticipateMeetingResponse = {
  meetingId: number
}

export type MyMeetingSummary = {
  meetingId: number
  title: string
  scheduledAt: string
  locationAddress: string
  targetHeadcount: number
  participantCount: number
  currentVoteId: number | null
  voteState: string | null
  finalSelected: boolean
}

export type MyMeetingsResponse = {
  items: MyMeetingSummary[]
  nextCursor: number | null
  hasNext: boolean
}
