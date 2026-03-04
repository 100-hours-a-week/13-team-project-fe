import { useEffect, useState } from 'react'
import styles from './QuickEnterPage.module.css'
import { enterQuickMeeting } from '@/entities/quick-meeting'
import { ApiError, initCsrfToken } from '@/shared/lib/api'
import { getQuickGuestUuid, removeQuickGuestUuid, saveQuickGuestUuid } from '@/shared/lib/quick-session'
import { navigate } from '@/shared/lib/navigation'

function normalizeInviteCode(value: string) {
  return value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 8)
}

export function QuickEnterPage() {
  const [inviteCode, setInviteCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void initCsrfToken()
  }, [])

  const handleEnter = async () => {
    if (inviteCode.length !== 8) {
      setError('초대코드 8자리를 입력해 주세요.')
      return
    }

    try {
      setLoading(true)
      setError(null)
      await initCsrfToken()

      const storedGuestUuid = getQuickGuestUuid(inviteCode)
      try {
        const response = await enterQuickMeeting({
          inviteCode,
          ...(storedGuestUuid ? { guestUuid: storedGuestUuid } : {}),
        })
        if (response.guestUuid) {
          saveQuickGuestUuid(inviteCode, response.guestUuid)
        }
      } catch (err) {
        if (err instanceof ApiError && err.status === 400 && storedGuestUuid) {
          removeQuickGuestUuid(inviteCode)
          const retry = await enterQuickMeeting({ inviteCode })
          if (retry.guestUuid) {
            saveQuickGuestUuid(inviteCode, retry.guestUuid)
          }
        } else {
          throw err
        }
      }

      navigate(`/quick/${inviteCode}`)
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 404) {
          setError('초대코드를 확인해주세요.')
          return
        }
        if (err.status === 409) {
          setError('정원이 가득 찼습니다.')
          return
        }
        if (err.status === 400) {
          setError('입장 정보가 올바르지 않아요. 다시 시도해 주세요.')
          return
        }
      }
      setError(err instanceof Error ? err.message : '퀵 모임 참가에 실패했어요.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <section className={styles.card}>
        <h1 className={styles.title}>퀵 모임 참여</h1>
        <p className={styles.description}>초대코드를 입력하고 바로 투표에 참여해 보세요.</p>

        <input
          className={styles.input}
          value={inviteCode}
          onChange={(event) => {
            setInviteCode(normalizeInviteCode(event.target.value))
            setError(null)
          }}
          placeholder="초대코드 8자리"
          maxLength={8}
        />

        {error ? <p className={styles.error}>{error}</p> : null}

        <button type="button" className={styles.primaryButton} onClick={() => void handleEnter()} disabled={loading}>
          {loading ? '입장 중...' : '입장하기'}
        </button>
      </section>
    </div>
  )
}
