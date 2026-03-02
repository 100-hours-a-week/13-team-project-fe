import { useState } from 'react'
import styles from './QuickEnterPage.module.css'
import { navigate } from '@/shared/lib/navigation'

function normalizeInviteCode(value: string) {
  return value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 8)
}

export function QuickEnterPage() {
  const [inviteCode, setInviteCode] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleEnter = () => {
    if (inviteCode.length !== 8) {
      setError('초대코드 8자리를 입력해 주세요.')
      return
    }
    navigate(`/quick/${inviteCode}`)
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

        <button type="button" className={styles.primaryButton} onClick={handleEnter}>
          입장하기
        </button>
      </section>
    </div>
  )
}
