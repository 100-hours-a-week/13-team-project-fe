export type SettlementStatus =
  | 'NOT_STARTED'
  | 'RECEIPT_UPLOADED'
  | 'OCR_PROCESSING'
  | 'OCR_FAILED'
  | 'OCR_SUCCEEDED'
  | 'SELECTION_OPEN'
  | 'CALCULATING'
  | 'RESULT_READY'
  | 'COMPLETED'

export type PaymentStatus = 'UNPAID' | 'REQUESTED' | 'DONE'

export type SettlementNextAction =
  | 'GO_RECEIPT_UPLOAD'
  | 'GO_OCR_LOADING'
  | 'GO_OCR_FAILED'
  | 'GO_OCR_EDIT'
  | 'GO_MENU_SELECTION'
  | 'GO_WAITING'
  | 'GO_RESULT'
  | 'GO_COMPLETED'
  | 'GO_MEETING_DETAIL_WITH_MODAL'

export type SettlementStateResponse = {
  nextAction: SettlementNextAction
  settlementStatus: SettlementStatus
}

export type SettlementReceiptUploadUrlResponse = {
  objectKey: string
  uploadUrl: string
  expiresAt: string
}

export type SettlementReceiptConfirmRequest = {
  objectKey: string
}

export type SettlementProgressResponse = {
  settlementStatus: SettlementStatus
}

export type SettlementItem = {
  itemId: number
  name: string
  unitPrice: number
  quantity: number
  totalPrice: number
}

export type SettlementItemsResponse = {
  receiptImageUrl: string | null
  totalAmount: number
  discountAmount: number
  items: SettlementItem[]
}

export type SettlementOpenSelectionRequest = {
  totalAmount: number
  discountAmount: number
  items: SettlementItem[]
}

export type SettlementSelectionResponse = {
  items: SettlementItem[]
  mySelectedItemIds: number[]
}

export type SettlementSelectionConfirmRequest = {
  selectedItemIds: number[]
}

export type SettlementWaitingResponse = {
  confirmedCount: number
  totalCount: number
  settlementStatus: SettlementStatus
}

export type SettlementResultParticipant = {
  participantId: number
  memberId: number
  nickname: string
  profileImageUrl: string | null
  amount: number
  paymentStatus: PaymentStatus
}

export type SettlementResultResponse = {
  participants: SettlementResultParticipant[]
}

export type SettlementCompletedResponse = {
  settlementStatus: SettlementStatus
}
