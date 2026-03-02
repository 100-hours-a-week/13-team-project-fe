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
  const session = getQuickSession(inviteCode)

  const [items, setItems] = useState<QuickVoteResultItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!session) {
      navigate(`/quick/${inviteCode}`, { replace: true })
      return
    }
    const voteId = session.currentVoteId
    if (voteId === null) {
      navigate(`/quick/${inviteCode}`, { replace: true })
      return
    }

    let active = true
    let timerId: number | null = null

    const fetchResults = async () => {
      try {
        if (!active) return
        setError(null)
        const response = await getQuickVoteResults(session.meetingId, voteId)
        if (!active) return
        setItems(response.items ?? [])
        setLoading(false)
      } catch (err) {
        if (!active) return
        if (err instanceof ApiError && err.status === 409) {
          timerId = window.setTimeout(fetchResults, 2000)
          setLoading(false)
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
  }, [inviteCode, session])

  const sorted = useMemo(() => [...items].sort((a, b) => a.rank - b.rank), [items])

  if (!session) return null

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>퀵모임 결과</h1>
      </header>

      {loading ? <p className={styles.note}>결과를 불러오는 중...</p> : null}
      {error ? <p className={styles.error}>{error}</p> : null}

      {!loading && !error && sorted.length === 0 ? (
        <p className={styles.note}>아직 결과 집계 중이에요.</p>
      ) : null}

      {!loading && !error && sorted.length > 0 ? (
        <section className={styles.list}>
          {sorted.map((item) => (
            <article key={item.candidateId} className={styles.card}>
              <div className={styles.row}>
                <strong>{item.rank}위</strong>
                <span className={styles.category}>{item.categoryName}</span>
              </div>
              <h2 className={styles.name}>{item.restaurantName}</h2>
              <p className={styles.meta}>좋아요 {item.likeCount} · 별점 {item.rating}</p>
              <p className={styles.address}>{item.roadAddress || item.jibunAddress}</p>
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
            navigate('/quick')
          }}
        >
          나가기
        </button>
      </div>
    </div>
  )
}
