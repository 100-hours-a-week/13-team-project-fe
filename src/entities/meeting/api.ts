import { request } from '@/shared/api/httpClient'
import type { MyMeetingsResponse, ParticipateMeetingResponse } from './types'

export async function participateMeeting(inviteCode: string) {
  return request<ParticipateMeetingResponse>('/api/v1/participate_meetings', {
    method: 'POST',
    body: { inviteCode },
  })
}

export async function getMyMeetings() {
  // TODO: 임시 memberId 파라미터 제거 후 실제 인증 기반 호출로 변경
  return request<MyMeetingsResponse>('/api/v1/meetings')
}
