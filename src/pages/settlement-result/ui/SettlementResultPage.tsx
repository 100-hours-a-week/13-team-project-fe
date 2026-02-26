import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import styles from './SettlementResultPage.module.css'
import { useAuth } from '@/app/providers/auth-context'
import {
  completeSettlement,
  confirmSettlementPayment,
  getSettlementResult,
  remindUnpaidSettlement,
  requestMySettlementPayment,
  type PaymentStatus,
  type SettlementResultParticipant,
} from '@/entities/settlement'
import { request } from '@/shared/lib/api'
import { navigate } from '@/shared/lib/navigation'
import { routeBySettlementState } from '@/shared/lib/settlement'

type MeetingHostResponse = {
  hostMemberId: number
}

const statusLabel: Record<PaymentStatus, string> = {
  UNPAID: '미송금',
  REQUESTED: '요청',
  DONE: '완료',
}

export function SettlementResultPage() {
  const { meetingId } = useParams()
  const { member } = useAuth()
  const parsedMeetingId = Number(meetingId)
  const [participants, setParticipants] = useState<SettlementResultParticipant[]>([])
  const [hostMemberId, setHostMemberId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const myMemberId = member?.memberId ?? null
  const isHost = hostMemberId !== null && myMemberId !== null && hostMemberId === myMemberId

  const fetchResult = useCallback(async () => {
    if (!Number.isFinite(parsedMeetingId)) {
      setError('모임 정보를 찾을 수 없어요.')
      setLoading(false)
      return
    }

    try {
      setError(null)
      const response = await getSettlementResult(parsedMeetingId)
      setParticipants(response.participants ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : '정산 결과를 불러오지 못했어요.')
      void routeBySettlementState(parsedMeetingId, { replace: true })
    } finally {
      setLoading(false)
    }
  }, [parsedMeetingId])

  useEffect(() => {
    if (!Number.isFinite(parsedMeetingId)) return

    let active = true
    const fetchHost = async () => {
      try {
        const response = await request<MeetingHostResponse>(`/api/v1/meetings/${parsedMeetingId}`)
        if (!active) return
        setHostMemberId(response.hostMemberId)
      } catch {
        // noop
      }
    }

    void fetchHost()
    void fetchResult()

    const timer = window.setInterval(() => {
      void fetchResult()
    }, 3000)

    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [fetchResult, parsedMeetingId])

  const myParticipant = useMemo(
    () => participants.find((item) => item.memberId === myMemberId),
    [myMemberId, participants],
  )

  useEffect(() => {
    if (participants.length === 0) return
    if (isHost && participants.every((item) => item.paymentStatus === 'DONE')) {
      navigate(`/meetings/${parsedMeetingId}/settlement/completed`, { replace: true })
      return
    }
    if (!isHost && myParticipant?.paymentStatus === 'DONE') {
      navigate(`/meetings/${parsedMeetingId}/settlement/completed`, { replace: true })
    }
  }, [isHost, myParticipant?.paymentStatus, parsedMeetingId, participants])

  const handleRequestMyPayment = async () => {
    if (!Number.isFinite(parsedMeetingId) || busyAction) return
    try {
      setBusyAction('request')
      await requestMySettlementPayment(parsedMeetingId)
      await fetchResult()
    } catch (err) {
      setError(err instanceof Error ? err.message : '송금 확인 요청에 실패했어요.')
      void routeBySettlementState(parsedMeetingId, { replace: true })
    } finally {
      setBusyAction(null)
    }
  }

  const handleConfirmParticipant = async (participantId: number) => {
    if (!Number.isFinite(parsedMeetingId) || busyAction) return
    try {
      setBusyAction(`confirm-${participantId}`)
      await confirmSettlementPayment(parsedMeetingId, participantId)
      await fetchResult()
    } catch (err) {
      setError(err instanceof Error ? err.message : '송금 완료 처리에 실패했어요.')
      void routeBySettlementState(parsedMeetingId, { replace: true })
    } finally {
      setBusyAction(null)
    }
  }

  const handleRemind = async () => {
    if (!Number.isFinite(parsedMeetingId) || busyAction) return
    try {
      setBusyAction('remind')
      await remindUnpaidSettlement(parsedMeetingId)
    } catch (err) {
      setError(err instanceof Error ? err.message : '미송금자 알림 전송에 실패했어요.')
    } finally {
      setBusyAction(null)
    }
  }

  const handleComplete = async () => {
    if (!Number.isFinite(parsedMeetingId) || busyAction) return
    try {
      setBusyAction('complete')
      await completeSettlement(parsedMeetingId)
      navigate(`/meetings/${parsedMeetingId}/settlement/completed`)
    } catch (err) {
      setError(err instanceof Error ? err.message : '정산 완료 처리에 실패했어요.')
      void routeBySettlementState(parsedMeetingId, { replace: true })
    } finally {
      setBusyAction(null)
    }
  }

  return (
    <div className={styles.page} data-page-id="settlement-result">
      <header className={styles.header}>
        <h1 className={styles.title}>정산 결과</h1>
      </header>

      {loading && <p className={styles.note}>결과를 불러오는 중...</p>}
      {error && <p className={styles.note}>{error}</p>}

      {!loading && (
        <>
          <section className={styles.list}>
            {participants.map((item) => (
              <article key={item.participantId} className={styles.item}>
                <div className={styles.profile}>
                  <div className={styles.avatar}>
                    {item.profileImageUrl ? (
                      <img src={item.profileImageUrl} alt={item.nickname} />
                    ) : (
                      <span>{item.nickname.charAt(0)}</span>
                    )}
                  </div>
                  <div>
                    <strong>{item.nickname}</strong>
                    <p>{item.amount.toLocaleString('ko-KR')}원</p>
                  </div>
                </div>
                <div className={styles.statusArea}>
                  <span className={styles.status}>{statusLabel[item.paymentStatus]}</span>
                  {isHost && item.paymentStatus !== 'DONE' && (
                    <button
                      type="button"
                      className={styles.inlineButton}
                      onClick={() => handleConfirmParticipant(item.participantId)}
                      disabled={busyAction !== null}
                    >
                      완료 처리
                    </button>
                  )}
                </div>
              </article>
            ))}
          </section>

          {isHost ? (
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={handleRemind}
                disabled={busyAction !== null}
              >
                미송금자 알림 보내기
              </button>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={handleComplete}
                disabled={busyAction !== null}
              >
                정산 완료
              </button>
            </div>
          ) : (
            <button
              type="button"
              className={styles.primaryButton}
              onClick={handleRequestMyPayment}
              disabled={busyAction !== null || myParticipant?.paymentStatus !== 'UNPAID'}
            >
              송금 확인 요청
            </button>
          )}
        </>
      )}
    </div>
  )
}
