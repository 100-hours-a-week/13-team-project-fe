import { request } from '@/shared/lib/api'
import type { RagAskRequest, RagAskResponse, RagHistoryResponse } from './types'

export async function askRagChat(payload: RagAskRequest) {
  return request<RagAskResponse>('/api/v1/rag-chat', {
    method: 'POST',
    body: JSON.stringify({
      user_id: payload.userId,
      message: payload.message,
    }),
  })
}

export async function getRagChatHistory(
  userId: string,
  limit = 20,
  beforeId?: number,
) {
  const query = new URLSearchParams()
  query.set('limit', String(limit))
  if (typeof beforeId === 'number' && Number.isFinite(beforeId)) {
    query.set('before_id', String(beforeId))
  }
  return request<RagHistoryResponse>(`/api/v1/rag-chat/history/${encodeURIComponent(userId)}?${query.toString()}`)
}

export async function clearRagChatHistory(userId: string) {
  return request<void>(`/api/v1/rag-chat/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
  })
}
