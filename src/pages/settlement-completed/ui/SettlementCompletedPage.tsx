import { useParams } from 'react-router-dom'
import styles from './SettlementCompletedPage.module.css'
import { navigate } from '@/shared/lib/navigation'

export function SettlementCompletedPage() {
  const { meetingId } = useParams()
  const parsedMeetingId = Number(meetingId)

  return (
    <div className={styles.page} data-page-id="settlement-completed">
      <header className={styles.header}>
        <h1 className={styles.title}>정산 완료</h1>
      </header>

      <div className={styles.completeIcon} aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <p className={styles.description}>정산이 완료되었어요.</p>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={() => navigate(`/meetings/${parsedMeetingId}`)}
        >
          모임 상세로 돌아가기
        </button>
      </div>
    </div>
  )
}
