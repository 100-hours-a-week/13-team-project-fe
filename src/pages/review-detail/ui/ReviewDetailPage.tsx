import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import styles from './ReviewDetailPage.module.css'
import { ApiError } from '@/shared/lib/api'
import { deleteReview, getReview, updateReview, type ReviewDetail } from '@/entities/review'
import { getFinalSelection, type FinalSelectionResponse } from '@/entities/vote'
import { navigate } from '@/shared/lib/navigation'

export function ReviewDetailPage() {
  const { reviewId } = useParams()
  const parsedReviewId = Number(reviewId)
  const [review, setReview] = useState<ReviewDetail | null>(null)
  const [rating, setRating] = useState<number | null>(null)
  const [hoverRating, setHoverRating] = useState<number | null>(null)
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [restaurant, setRestaurant] = useState<FinalSelectionResponse | null>(null)

  useEffect(() => {
    if (!Number.isFinite(parsedReviewId)) {
      setError('리뷰 정보를 찾을 수 없어요.')
      setLoading(false)
      return
    }

    let active = true

    const load = async () => {
      try {
        setLoading(true)
        setError(null)
        const detail = await getReview(parsedReviewId)
        if (!active) return
        setReview(detail)
        setRating(detail.rating)
        setContent(detail.content)
        try {
          const finalSelection = await getFinalSelection(detail.meetingId)
          if (!active) return
          setRestaurant(finalSelection)
        } catch {
          if (!active) return
          setRestaurant(null)
        }
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err.message : '리뷰를 불러오지 못했어요.')
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void load()
    return () => {
      active = false
    }
  }, [parsedReviewId])

  const handleSave = async () => {
    if (!review) return
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
      const updated = await updateReview(review.reviewId, {
        rating,
        content: trimmed,
      })
      setReview(updated)
      setRating(updated.rating)
      setContent(updated.content)
      setEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : '리뷰 수정에 실패했어요.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!review || submitting) return

    const confirmed = window.confirm('리뷰를 삭제하시겠어요?')
    if (!confirmed) return

    try {
      setSubmitting(true)
      setError(null)
      await deleteReview(review.reviewId)
      navigate('/mypage?tab=reviews', { replace: true })
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setError('이미 삭제되었거나 조회할 수 없는 리뷰예요.')
      } else {
        setError(err instanceof Error ? err.message : '리뷰 삭제에 실패했어요.')
      }
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <p className={styles.note}>리뷰를 불러오는 중...</p>
      </div>
    )
  }

  if (!review) {
    return (
      <div className={styles.page}>
        <p className={styles.note}>{error ?? '리뷰를 찾을 수 없어요.'}</p>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={() => navigate('/mypage?tab=reviews')}
        >
          내 리뷰로 이동
        </button>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>리뷰 상세</h1>
      </header>

      <div className={styles.cardWrap}>
        <div className={styles.floatingActions}>
          {!editing ? (
            <button
              type="button"
              className={styles.smallPrimaryButton}
              onClick={() => setEditing(true)}
              disabled={submitting}
            >
              수정
            </button>
          ) : (
            <button
              type="button"
              className={styles.smallPrimaryButton}
              onClick={() => {
                void handleSave()
              }}
              disabled={submitting || rating === null}
            >
              {submitting ? '저장 중...' : '저장'}
            </button>
          )}
          <button
            type="button"
            className={styles.smallDeleteButton}
            onClick={() => {
              void handleDelete()
            }}
            disabled={submitting}
          >
            삭제
          </button>
        </div>

        <section className={styles.card}>
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
                <div className={styles.nameRow}>
                  <strong>{restaurant.restaurantName}</strong>
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
                  disabled={!editing || submitting}
                  aria-label={`${score}점`}
                >
                  ★
                </button>
              ))}
            </div>
            <div className={styles.scoreText}>
              {hoverRating !== null
                ? `${hoverRating}점`
                : rating !== null
                  ? `${rating}점`
                  : '별점을 선택해 주세요'}
            </div>
          </div>

          <label className={styles.field}>
            <span>내용</span>
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              rows={6}
              maxLength={500}
              disabled={!editing || submitting}
            />
          </label>

          {error && <p className={styles.error}>{error}</p>}
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => navigate('/mypage?tab=reviews')}
            disabled={submitting}
          >
            목록
          </button>
        </section>
      </div>
    </div>
  )
}
