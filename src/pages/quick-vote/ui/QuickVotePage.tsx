import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import styles from './QuickVotePage.module.css'
import { ApiError } from '@/shared/lib/api'
import {
  getQuickVoteCandidates,
  getQuickVoteStatus,
  submitQuickVote,
  type QuickVoteCandidate,
  type QuickVoteStatusResponse,
} from '@/entities/quick-meeting'
import type { VoteChoice } from '@/entities/vote'
import { getQuickSession, saveQuickSession } from '@/shared/lib/quick-session'
import { navigate } from '@/shared/lib/navigation'

function normalizeInviteCode(value: string | undefined) {
  return (value ?? '').trim().toUpperCase()
}

function formatLeftTime(deadline: string) {
  const remainMs = new Date(deadline).getTime() - Date.now()
  if (!Number.isFinite(remainMs) || remainMs <= 0) return '마감됨'
  const totalSec = Math.floor(remainMs / 1000)
  const min = String(Math.floor(totalSec / 60)).padStart(2, '0')
  const sec = String(totalSec % 60).padStart(2, '0')
  return `${min}:${sec}`
}

const choiceLabel: Record<VoteChoice, string> = {
  LIKE: '좋아요',
  DISLIKE: '별로예요',
  NEUTRAL: '무난해요',
}

export function QuickVotePage() {
  const { inviteCode: inviteCodeParam } = useParams()
  const inviteCode = normalizeInviteCode(inviteCodeParam)
  const session = getQuickSession(inviteCode)

  const [leftTime, setLeftTime] = useState('')
  const [candidates, setCandidates] = useState<QuickVoteCandidate[]>([])
  const [selections, setSelections] = useState<Record<number, VoteChoice>>({})
  const [status, setStatus] = useState<QuickVoteStatusResponse | null>(null)
  const [loadingCandidates, setLoadingCandidates] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (session?.voteDeadlineAt) {
      const update = () => setLeftTime(formatLeftTime(session.voteDeadlineAt))
      update()
      const timerId = window.setInterval(update, 1000)
      return () => window.clearInterval(timerId)
    }
    return
  }, [session?.voteDeadlineAt])

  useEffect(() => {
    if (!session || !session.currentVoteId) {
      navigate(`/quick/${inviteCode}`, { replace: true })
      return
    }

    let active = true
    let timerId: number | null = null
    let attempt = 0

    const fetchCandidates = async () => {
      try {
        if (!active) return
        setLoadingCandidates(true)
        setError(null)
        const response = await getQuickVoteCandidates(session.meetingId, session.currentVoteId)
        if (!active) return
        setCandidates(response.candidates ?? [])
        setLoadingCandidates(false)
      } catch (err) {
        if (!active) return
        if (err instanceof ApiError && err.status === 409 && attempt < 20) {
          attempt += 1
          timerId = window.setTimeout(fetchCandidates, 1500)
          return
        }
        setLoadingCandidates(false)
        setError(err instanceof Error ? err.message : '후보를 불러오지 못했어요.')
      }
    }

    void fetchCandidates()

    return () => {
      active = false
      if (timerId) window.clearTimeout(timerId)
    }
  }, [inviteCode, session])

  useEffect(() => {
    if (!session || !session.currentVoteId || !submitted) return

    let active = true
    const poll = async () => {
      try {
        const response = await getQuickVoteStatus(session.meetingId, session.currentVoteId)
        if (!active) return
        setStatus(response)
        if (response.voteStatus === 'COUNTED') {
          saveQuickSession(inviteCode, { ...session, voteStatus: 'COUNTED' })
          navigate(`/quick/${inviteCode}/result`, { replace: true })
        }
      } catch {
        // noop
      }
    }

    void poll()
    const timerId = window.setInterval(poll, 2000)

    return () => {
      active = false
      window.clearInterval(timerId)
    }
  }, [inviteCode, session, submitted])

  const selectedCount = useMemo(() => Object.keys(selections).length, [selections])

  const handleSelect = (candidateId: number, choice: VoteChoice) => {
    setSelections((prev) => ({ ...prev, [candidateId]: choice }))
  }

  const handleSubmit = useCallback(async () => {
    if (!session || !session.currentVoteId || submitting) return

    if (candidates.length === 0) {
      setError('후보 정보가 없어요.')
      return
    }

    const items = candidates
      .map((candidate) => ({
        candidateId: candidate.candidateId,
        choice: selections[candidate.candidateId],
      }))
      .filter((item): item is { candidateId: number; choice: VoteChoice } => Boolean(item.choice))

    if (items.length !== candidates.length) {
      setError('모든 후보에 대해 선택해 주세요.')
      return
    }

    try {
      setSubmitting(true)
      setError(null)
      await submitQuickVote(session.meetingId, session.currentVoteId, { items })
      setSubmitted(true)
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setSubmitted(true)
        return
      }
      setError(err instanceof Error ? err.message : '투표 제출에 실패했어요.')
    } finally {
      setSubmitting(false)
    }
  }, [candidates, selections, session, submitting])

  if (!session) {
    return null
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>퀵 투표</h1>
        <p className={styles.deadline}>마감까지 {leftTime || '확인 중...'}</p>
      </header>

      {loadingCandidates ? <p className={styles.note}>후보를 불러오는 중...</p> : null}
      {error ? <p className={styles.error}>{error}</p> : null}

      {!loadingCandidates && !submitted && (
        <section className={styles.list}>
          {candidates.map((candidate) => (
            <article key={candidate.candidateId} className={styles.card}>
              <div className={styles.cardHeader}>
                <strong>{candidate.restaurantName}</strong>
                <span className={styles.category}>{candidate.categoryName}</span>
              </div>
              <p className={styles.meta}>거리 {candidate.distanceM}m · 별점 {candidate.rating}</p>
              <p className={styles.address}>{candidate.roadAddress || candidate.jibunAddress}</p>
              <div className={styles.choices}>
                {(['LIKE', 'DISLIKE', 'NEUTRAL'] as const).map((choice) => {
                  const active = selections[candidate.candidateId] === choice
                  return (
                    <button
                      key={choice}
                      type="button"
                      className={active ? styles.choiceActive : styles.choiceButton}
                      onClick={() => handleSelect(candidate.candidateId, choice)}
                    >
                      {choiceLabel[choice]}
                    </button>
                  )
                })}
              </div>
            </article>
          ))}
        </section>
      )}

      {submitted ? (
        <section className={styles.waitCard}>
          <p>투표를 제출했어요. 집계가 끝나면 결과로 이동합니다.</p>
          <p>
            {status ? `${status.submittedCount}/${status.totalCount}명 제출` : '제출 현황 확인 중...'}
          </p>
        </section>
      ) : null}

      {!submitted ? (
        <button
          type="button"
          className={styles.primaryButton}
          onClick={() => {
            void handleSubmit()
          }}
          disabled={submitting || selectedCount !== candidates.length || candidates.length === 0}
        >
          {submitting ? '제출 중...' : '투표 제출'}
        </button>
      ) : null}

      <button
        type="button"
        className={styles.secondaryButton}
        onClick={() => navigate(`/quick/${inviteCode}`)}
      >
        퀵모임 상세로
      </button>
    </div>
  )
}
