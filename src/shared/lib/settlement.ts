import {
  getSettlementState,
  type SettlementNextAction,
} from '@/entities/settlement'
import { ApiError } from '@/shared/lib/api'
import { navigate } from '@/shared/lib/navigation'

export function getSettlementPathByAction(
  meetingId: number,
  nextAction: SettlementNextAction,
) {
  switch (nextAction) {
    case 'GO_RECEIPT_UPLOAD':
      return `/meetings/${meetingId}/settlement/receipt`
    case 'GO_OCR_LOADING':
      return `/meetings/${meetingId}/settlement/ocr/loading`
    case 'GO_OCR_FAILED':
      return `/meetings/${meetingId}/settlement/ocr/failed`
    case 'GO_OCR_EDIT':
      return `/meetings/${meetingId}/settlement/ocr/edit`
    case 'GO_MENU_SELECTION':
      return `/meetings/${meetingId}/settlement/selection`
    case 'GO_WAITING':
      return `/meetings/${meetingId}/settlement/wait`
    case 'GO_RESULT':
      return `/meetings/${meetingId}/settlement/result`
    case 'GO_COMPLETED':
      return `/meetings/${meetingId}/settlement/completed`
    case 'GO_MEETING_DETAIL_WITH_MODAL':
      return `/meetings/${meetingId}`
    default:
      return `/meetings/${meetingId}`
  }
}

export async function routeBySettlementState(
  meetingId: number,
  options: {
    replace?: boolean
    onKeepMeetingDetail?: () => void
  } = {},
) {
  const state = await getSettlementState(meetingId)
  if (state.nextAction === 'GO_MEETING_DETAIL_WITH_MODAL') {
    options.onKeepMeetingDetail?.()
    navigate(`/meetings/${meetingId}`, { replace: options.replace })
    return state.nextAction
  }
  navigate(getSettlementPathByAction(meetingId, state.nextAction), {
    replace: options.replace,
  })
  return state.nextAction
}

export function hasSettlementErrorCode(error: unknown, code: string) {
  if (!(error instanceof ApiError)) return false
  const source = `${error.message} ${error.detail ?? ''}`.toUpperCase()
  return source.includes(code.toUpperCase())
}
