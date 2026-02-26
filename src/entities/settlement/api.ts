import { request } from '@/shared/lib/api'
import type {
  SettlementCompletedResponse,
  SettlementItemsResponse,
  SettlementOpenSelectionRequest,
  SettlementProgressResponse,
  SettlementReceiptConfirmRequest,
  SettlementReceiptUploadUrlResponse,
  SettlementResultResponse,
  SettlementSelectionConfirmRequest,
  SettlementSelectionResponse,
  SettlementStateResponse,
  SettlementWaitingResponse,
} from './types'

export async function getSettlementState(meetingId: number) {
  return request<SettlementStateResponse>(`/api/v1/meetings/${meetingId}/settlement/state`)
}

export async function createSettlementReceiptUploadUrl(
  meetingId: number,
  contentType: string,
) {
  return request<SettlementReceiptUploadUrlResponse>(
    `/api/v1/meetings/${meetingId}/settlement/receipt/upload-url`,
    {
      method: 'POST',
      body: JSON.stringify({ contentType }),
    },
  )
}

export async function confirmSettlementReceipt(
  meetingId: number,
  payload: SettlementReceiptConfirmRequest,
) {
  return request<void>(`/api/v1/meetings/${meetingId}/settlement/receipt/confirm`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function startSettlementOcr(meetingId: number) {
  return request<void>(`/api/v1/meetings/${meetingId}/settlement/ocr`, {
    method: 'POST',
  })
}

export async function getSettlementProgress(meetingId: number) {
  return request<SettlementProgressResponse>(
    `/api/v1/meetings/${meetingId}/settlement/progress`,
  )
}

export async function getSettlementItems(meetingId: number) {
  return request<SettlementItemsResponse>(`/api/v1/meetings/${meetingId}/settlement/items`)
}

export async function openSettlementSelection(
  meetingId: number,
  payload: SettlementOpenSelectionRequest,
) {
  return request<void>(`/api/v1/meetings/${meetingId}/settlement/open-selection`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function getSettlementSelection(meetingId: number) {
  return request<SettlementSelectionResponse>(
    `/api/v1/meetings/${meetingId}/settlement/selection`,
  )
}

export async function confirmSettlementSelection(
  meetingId: number,
  payload: SettlementSelectionConfirmRequest,
) {
  return request<void>(`/api/v1/meetings/${meetingId}/settlement/selection/confirm`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function getSettlementWaiting(meetingId: number) {
  return request<SettlementWaitingResponse>(`/api/v1/meetings/${meetingId}/settlement/waiting`)
}

export async function getSettlementResult(meetingId: number) {
  return request<SettlementResultResponse>(`/api/v1/meetings/${meetingId}/settlement/result`)
}

export async function requestMySettlementPayment(meetingId: number) {
  return request<void>(`/api/v1/meetings/${meetingId}/settlement/payments/me/request`, {
    method: 'POST',
  })
}

export async function confirmSettlementPayment(
  meetingId: number,
  participantId: number,
) {
  return request<void>(
    `/api/v1/meetings/${meetingId}/settlement/payments/${participantId}/confirm`,
    {
      method: 'POST',
    },
  )
}

export async function remindUnpaidSettlement(meetingId: number) {
  return request<void>(`/api/v1/meetings/${meetingId}/settlement/remind-unpaid`, {
    method: 'POST',
  })
}

export async function completeSettlement(meetingId: number) {
  return request<void>(`/api/v1/meetings/${meetingId}/settlement/complete`, {
    method: 'POST',
  })
}

export async function getSettlementCompleted(meetingId: number) {
  return request<SettlementCompletedResponse>(
    `/api/v1/meetings/${meetingId}/settlement/completed`,
  )
}
