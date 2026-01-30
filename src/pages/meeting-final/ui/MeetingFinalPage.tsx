import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import styles from './MeetingFinalPage.module.css'
import { getFinalSelection } from '@/entities/vote'
import { navigate } from '@/shared/lib/navigation'

type LoadState = 'loading' | 'error' | 'success'

export function MeetingFinalPage() {
  const { meetingId } = useParams()
  const [status, setStatus] = useState<LoadState>('loading')
  const [error, setError] = useState<string | null>(null)
  const [imageIndex, setImageIndex] = useState(0)
  const [data, setData] = useState<Awaited<ReturnType<typeof getFinalSelection>> | null>(
    null,
  )

  const backPath = useMemo(() => {
    if (meetingId) return `/meetings/${meetingId}`
    return '/main'
  }, [meetingId])

  const parsedMeetingId = Number(meetingId)

  const fetchFinal = useCallback(async () => {
    if (!Number.isFinite(parsedMeetingId)) {
      setError('모임 정보를 찾을 수 없습니다.')
      setStatus('error')
      return
    }

    try {
      setStatus('loading')
      setError(null)
      const response = await getFinalSelection(parsedMeetingId)
      setData(response)
      setImageIndex(0)
      setStatus('success')
    } catch (err) {
      setError(err instanceof Error ? err.message : '최종 결과를 불러오지 못했습니다.')
      setStatus('error')
    }
  }, [parsedMeetingId])

  useEffect(() => {
    void fetchFinal()
  }, [fetchFinal])

  const images = useMemo(() => {
    if (!data) return []
    return [data.imageUrl1, data.imageUrl2, data.imageUrl3].filter(Boolean) as string[]
  }, [data])

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button
          type="button"
          className={styles.backButton}
          onClick={() => navigate(backPath)}
          aria-label="모임 상세로 돌아가기"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className={styles.title}>최종 결과</h1>
      </header>

      {status === 'loading' && <p className={styles.note}>최종 결과를 불러오는 중...</p>}
      {status === 'error' && <p className={styles.note}>{error}</p>}

      {status === 'success' && data && (
        <section className={styles.card}>
          <div className={styles.imageArea}>
            {images.length > 0 ? (
              <>
                <img src={images[imageIndex]} alt={data.restaurantName} />
                {images.length > 1 && (
                  <div className={styles.imageNav}>
                    <button
                      type="button"
                      className={styles.imageButton}
                      onClick={() =>
                        setImageIndex((prev) => (prev - 1 + images.length) % images.length)
                      }
                      aria-label="이전 이미지"
                    >
                      ‹
                    </button>
                    <div className={styles.imageDots}>
                      {images.map((_, index) => (
                        <span
                          key={`dot-${index}`}
                          className={index === imageIndex ? styles.dotActive : styles.dot}
                        />
                      ))}
                    </div>
                    <button
                      type="button"
                      className={styles.imageButton}
                      onClick={() => setImageIndex((prev) => (prev + 1) % images.length)}
                      aria-label="다음 이미지"
                    >
                      ›
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className={styles.imagePlaceholder}>이미지가 없어요</div>
            )}
          </div>

          <div className={styles.infoArea}>
            <div className={styles.titleRow}>
              <h2 className={styles.restaurantName}>{data.restaurantName}</h2>
              <span className={styles.category}>{data.categoryName}</span>
            </div>
            <div className={styles.metaRow}>
              <span>별점 {data.rating}</span>
              <span>거리 {data.distanceM}m</span>
            </div>
            <div className={styles.address}>
              {data.roadAddress || data.jibunAddress}
            </div>
          </div>
        </section>
      )}

      <button type="button" className={styles.primaryButton} onClick={() => navigate(backPath)}>
        모임 상세로 돌아가기
      </button>
    </div>
  )
}
