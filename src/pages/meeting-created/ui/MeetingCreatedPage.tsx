import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import styles from './MeetingCreatedPage.module.css'
import { request } from '@/shared/lib/api'

type InviteResponse = {
  meetingId: number
  inviteCode: string
}

export function MeetingCreatedPage() {
  const { meetingId } = useParams()
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const [copiedText, setCopiedText] = useState<string | null>(null)

  const inviteLink = useMemo(() => {
    if (!inviteCode) return ''
    return `${window.location.origin}/meetings/join?code=${inviteCode}`
  }, [inviteCode])

  const fetchInvite = useCallback(async () => {
    if (!meetingId) {
      setStatus('error')
      setMessage('모임 정보를 찾을 수 없습니다.')
      return
    }

    try {
      setStatus('loading')
      setMessage(null)

      const data: unknown = await request(`/api/v1/meetings/${meetingId}/invite-code`)

      const typed = data as InviteResponse
      if (!typed?.inviteCode) {
        throw new Error('초대코드를 불러오지 못했습니다.')
      }

      setInviteCode(typed.inviteCode)
      setStatus('idle')
    } catch (error) {
      setStatus('error')
      setMessage(
        error instanceof Error ? error.message : '초대코드를 불러오지 못했습니다.',
      )
    }
  }, [meetingId])

  useEffect(() => {
    void fetchInvite()
  }, [fetchInvite])

  const setCopiedFeedback = useCallback((text: string) => {
    setCopiedText(text)
    window.setTimeout(() => {
      setCopiedText(null)
    }, 1500)
  }, [])

  const copyWithFallback = useCallback(
    (text: string) => {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.focus()
      textarea.select()

      try {
        const success = document.execCommand('copy')
        document.body.removeChild(textarea)
        if (success) {
          setCopiedFeedback('복사 완료!')
          return
        }
        throw new Error('copy failed')
      } catch {
        document.body.removeChild(textarea)
        setMessage('복사에 실패했습니다.')
      }
    },
    [setCopiedFeedback],
  )

  const handleCopy = useCallback(
    async (text: string) => {
      if (!text) return
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text)
          setCopiedFeedback('복사 완료!')
          return
        }
        copyWithFallback(text)
      } catch {
        copyWithFallback(text)
      }
    },
    [copyWithFallback, setCopiedFeedback],
  )

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>모임이 생성됐어요!</h1>
        <p className={styles.subtitle}>
          초대코드를 공유해서 모임에 참여하도록 안내해 주세요.
        </p>

        {status === 'loading' && (
          <div className={styles.state}>초대코드를 불러오는 중...</div>
        )}

        {status === 'error' && (
          <div className={styles.stateError}>
            <p>{message ?? '초대코드를 불러오지 못했습니다.'}</p>
            <button
              type="button"
              className={styles.retryButton}
              onClick={fetchInvite}
            >
              다시 시도
            </button>
          </div>
        )}

        {status === 'idle' && inviteCode && (
          <>
            <div className={styles.codeBox}>{inviteCode}</div>
            {copiedText && <div className={styles.copied}>{copiedText}</div>}

            <div className={styles.buttonGroup}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => handleCopy(inviteCode)}
              >
                초대코드 복사
              </button>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => handleCopy(inviteLink)}
                disabled={!inviteLink}
              >
                초대 링크 복사
              </button>
              <Link to={`/meetings/${meetingId}`} className={styles.primaryButton}>
                모임 상세로 이동
              </Link>
            </div>
          </>
        )}

        {status === 'idle' && !inviteCode && (
          <div className={styles.stateError}>초대코드를 불러오지 못했습니다.</div>
        )}
      </div>
    </div>
  )
}
