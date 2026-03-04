import type { QuickMeetingDetailResponse } from '@/entities/quick-meeting'

export type QuickSession = {
  meetingId: number
  inviteCode: string
  locationAddress: string
  participantCount: number
  targetHeadcount: number
  voteDeadlineAt: string
  currentVoteId: number | null
  voteStatus: QuickMeetingDetailResponse['voteStatus']
  hostMemberId?: number | null
}

function guestUuidKey(inviteCode: string) {
  return `quick_guest_uuid:${inviteCode.toUpperCase()}`
}

function sessionKey(inviteCode: string) {
  return `quick_session:${inviteCode.toUpperCase()}`
}

export function getQuickGuestUuid(inviteCode: string) {
  return localStorage.getItem(guestUuidKey(inviteCode))
}

export function saveQuickGuestUuid(inviteCode: string, guestUuid: string) {
  localStorage.setItem(guestUuidKey(inviteCode), guestUuid)
}

export function removeQuickGuestUuid(inviteCode: string) {
  localStorage.removeItem(guestUuidKey(inviteCode))
}

export function getQuickSession(inviteCode: string): QuickSession | null {
  const raw = sessionStorage.getItem(sessionKey(inviteCode))
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as QuickSession
    if (!parsed.meetingId || !parsed.inviteCode) return null
    return parsed
  } catch {
    return null
  }
}

export function saveQuickSession(inviteCode: string, session: QuickSession) {
  sessionStorage.setItem(sessionKey(inviteCode), JSON.stringify(session))
}

export function removeQuickSession(inviteCode: string) {
  sessionStorage.removeItem(sessionKey(inviteCode))
}
