import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import styles from './QuickResultPage.module.css'
import { ApiError } from '@/shared/lib/api'
import { getQuickVoteResults, type QuickVoteResultItem } from '@/entities/quick-meeting'
import { getQuickSession, removeQuickSession } from '@/shared/lib/quick-session'
import { navigate } from '@/shared/lib/navigation'

function normalizeInviteCode(value: string | undefined) {
  return (value ?? '').trim().toUpperCase()
}

export function QuickResultPage() {
  const { inviteCode: inviteCodeParam } = useParams()
  const inviteCode = normalizeInviteCode(inviteCodeParam)
  const session = useMemo(() => getQuickSession(inviteCode), [inviteCode])
  const meetingId = session?.meetingId ?? null
  const voteId = session?.currentVoteId ?? null

  const [items, setItems] = useState<QuickVoteResultItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!session) {
      navigate(`/quick/${inviteCode}`, { replace: true })
      return
    }
    if (voteId === null) {
      navigate(`/quick/${inviteCode}`, { replace: true })
      return
    }
    if (meetingId === null) {
      navigate(`/quick/${inviteCode}`, { replace: true })
      return
    }

    let active = true
    let timerId: number | null = null
    let attempts = 0

    const fetchResults = async () => {
      try {
        if (!active) return
        setError(null)
        const response = await getQuickVoteResults(meetingId, voteId)
        if (!active) return
        setItems(response.items ?? [])
        setLoading(false)
      } catch (err) {
        if (!active) return
        if (err instanceof ApiError && err.status === 409 && attempts < 30) {
          attempts += 1
          timerId = window.setTimeout(fetchResults, 2000)
          return
        }
        setError(err instanceof Error ? err.message : '결과를 불러오지 못했어요.')
        setLoading(false)
      }
    }

    void fetchResults()

    return () => {
      active = false
      if (timerId) window.clearTimeout(timerId)
    }
  }, [inviteCode, meetingId, session, voteId])

  const sorted = useMemo(() => [...items].sort((a, b) => a.rank - b.rank), [items])

  if (!session) return null

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button
          type="button"
          className={styles.backButton}
          onClick={() => navigate(`/quick/${inviteCode}`)}
          aria-label="퀵모임 상세로 돌아가기"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className={styles.title}>퀵모임 결과</h1>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroBadge}>
          <span className={styles.checkIcon} aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M5 13l4 4L19 7" />
            </svg>
          </span>
          <span className={styles.heroTitle}>TOP3</span>
        </div>
        <p className={styles.heroText}>퀵모임 투표 결과가 나왔어요!</p>
      </section>

      {loading ? <p className={styles.note}>결과를 불러오는 중...</p> : null}
      {error ? <p className={styles.note}>{error}</p> : null}

      {!loading && !error && sorted.length === 0 ? (
        <p className={styles.note}>아직 결과 집계 중이에요.</p>
      ) : null}

      {!loading && !error && sorted.length > 0 ? (
        <section className={styles.list}>
          {sorted.map((item) => (
            <article key={item.candidateId} className={styles.card}>
              <div className={styles.rankBadge}>{item.rank}등</div>
              <div className={styles.cardContent}>
                <div className={styles.imageWrap}>
                  {item.imageUrl1 ? (
                    <img src={item.imageUrl1} alt={item.restaurantName} />
                  ) : (
                    <div className={styles.imagePlaceholder}>이미지 없음</div>
                  )}
                </div>
                <div className={styles.info}>
                  <div className={styles.nameRow}>
                    <h2 className={styles.name}>{item.restaurantName}</h2>
                    <span className={styles.categoryInline}>{item.categoryName}</span>
                  </div>
                  <p className={styles.meta}>
                    <span>별점 {item.rating}</span>
                    <span>거리 {item.distanceM}m</span>
                  </p>
                  <p className={styles.address}>{item.roadAddress || item.jibunAddress}</p>
                </div>
              </div>
            </article>
          ))}
        </section>
      ) : null}

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={() => navigate(`/quick/${inviteCode}`)}
        >
          상세로 이동
        </button>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={() => {
            removeQuickSession(inviteCode)
            navigate('/main')
          }}
        >
          나가기
        </button>
      </div>
    </div>
  )
}
