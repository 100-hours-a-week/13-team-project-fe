import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import styles from './ReviewCreatePage.module.css'
import { ApiError } from '@/shared/lib/api'
import { createMeetingReview } from '@/entities/review'
import { getFinalSelection, type FinalSelectionResponse } from '@/entities/vote'
import { navigate } from '@/shared/lib/navigation'

export function ReviewCreatePage() {
  const { meetingId } = useParams()
  const parsedMeetingId = Number(meetingId)
  const [rating, setRating] = useState<number | null>(null)
  const [hoverRating, setHoverRating] = useState<number | null>(null)
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [restaurant, setRestaurant] = useState<FinalSelectionResponse | null>(null)
  const [restaurantLoading, setRestaurantLoading] = useState(true)

  useEffect(() => {
    if (!Number.isFinite(parsedMeetingId)) {
      setError('모임 정보를 찾을 수 없어요.')
      setRestaurantLoading(false)
      return
    }

    let active = true

    const loadFinalSelection = async () => {
      try {
        setRestaurantLoading(true)
        const response = await getFinalSelection(parsedMeetingId)
        if (!active) return
        setRestaurant(response)
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err.message : '식당 정보를 불러오지 못했어요.')
      } finally {
        if (active) {
          setRestaurantLoading(false)
        }
      }
    }

    void loadFinalSelection()
    return () => {
      active = false
    }
  }, [parsedMeetingId])

  const handleSubmit = async () => {
    if (!Number.isFinite(parsedMeetingId)) {
      setError('모임 정보를 찾을 수 없어요.')
      return
    }

    const trimmed = content.trim()
    if (rating === null) {
      setError('별점을 선택해 주세요.')
      return
    }
    if (!trimmed) {
      setError('리뷰 내용을 입력해 주세요.')
      return
    }

    try {
      setSubmitting(true)
      setError(null)
      const response = await createMeetingReview(parsedMeetingId, {
        rating,
        content: trimmed,
      })
      navigate(`/reviews/${response.reviewId}`)
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        navigate('/mypage?tab=reviews')
        return
      }
      setError(err instanceof Error ? err.message : '리뷰 작성에 실패했어요.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>리뷰 작성</h1>
        <p className={styles.description}>모임의 최종 식당을 평가해 주세요.</p>
      </header>

      <section className={styles.card}>
        {restaurantLoading ? <p className={styles.note}>식당 정보를 불러오는 중...</p> : null}
        {restaurant ? (
          <article className={styles.restaurantCard}>
            {restaurant.imageUrl1 ? (
              <img
                className={styles.restaurantImage}
                src={restaurant.imageUrl1}
                alt={restaurant.restaurantName}
              />
            ) : null}
            <div className={styles.restaurantInfo}>
              <strong>{restaurant.restaurantName}</strong>
              <div className={styles.restaurantMeta}>
                <span className={styles.categoryBadge}>{restaurant.categoryName}</span>
              </div>
            </div>
          </article>
        ) : null}

        <div className={`${styles.field} ${styles.ratingField}`}>
          <span>평점</span>
          <div className={styles.starRow}>
            {[1, 2, 3, 4, 5].map((score) => (
              <button
                key={score}
                type="button"
                className={
                  score <= (hoverRating ?? rating ?? 0) ? styles.starActive : styles.star
                }
                onMouseEnter={() => setHoverRating(score)}
                onMouseLeave={() => setHoverRating(null)}
                onFocus={() => setHoverRating(score)}
                onBlur={() => setHoverRating(null)}
                onClick={() => {
                  setRating(score)
                  setError(null)
                }}
                disabled={submitting}
                aria-label={`${score}점`}
              >
                ★
              </button>
            ))}
          </div>
        </div>

        <label className={styles.field}>
          <span>내용</span>
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="리뷰를 입력해 주세요"
            rows={6}
            maxLength={500}
            disabled={submitting}
          />
        </label>

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => navigate(`/meetings/${parsedMeetingId}`)}
            disabled={submitting}
          >
            취소
          </button>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => {
              void handleSubmit()
            }}
            disabled={submitting || rating === null}
          >
            {submitting ? '저장 중...' : '저장'}
          </button>
        </div>
      </section>
    </div>
  )
}
