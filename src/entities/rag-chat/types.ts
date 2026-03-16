export type RagRole = 'user' | 'assistant'

export type RagAskRequest = {
  userId: string
  message: string
}

export type RagAskResponse = {
  answer: string
  user_id: string
}

export type RagHistoryMessage = {
  id: number
  role: RagRole
  content: string
  created_at: string
}

export type RagHistoryResponse = {
  messages: RagHistoryMessage[]
  next_cursor: number | null
}
