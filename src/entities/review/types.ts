export type ReviewItem = {
  reviewId: number
  meetingId: number
  rating: number
  content: string
  createdAt: string
  restaurantId: number
  restaurantName: string
  restaurantImageUrl1: string | null
  categoryName: string
  categoryEmoji: string
}

export type ReviewListResponse = {
  items: ReviewItem[]
  nextCursor: number | null
  hasNext: boolean
}

export type ReviewDetail = {
  reviewId: number
  meetingId: number
  rating: number
  content: string
  createdAt: string
  updatedAt: string
  restaurantId: number
  restaurantName: string
  restaurantImageUrl1: string | null
  categoryName: string
  categoryEmoji: string
}

export type CreateReviewRequest = {
  rating: number
  content: string
}

export type CreateReviewResponse = {
  reviewId: number
}

export type UpdateReviewRequest = {
  rating: number
  content: string
}
