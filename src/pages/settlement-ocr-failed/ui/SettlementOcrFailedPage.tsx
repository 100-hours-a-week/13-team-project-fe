import { useParams } from 'react-router-dom'
import styles from './SettlementOcrFailedPage.module.css'
import { navigate } from '@/shared/lib/navigation'

export function SettlementOcrFailedPage() {
  const { meetingId } = useParams()
  const parsedMeetingId = Number(meetingId)

  return (
    <div className={styles.page} data-page-id="settlement-ocr-failed">
      <header className={styles.header}>
        <h1 className={styles.title}>OCR 실패</h1>
      </header>
      <p className={styles.description}>
        영수증 인식에 실패했어요. 이미지를 다시 선택해 주세요.
      </p>
      <button
        type="button"
        className={styles.primaryButton}
        onClick={() => navigate(`/meetings/${parsedMeetingId}/settlement/receipt`)}
      >
        다시 선택
      </button>
      <button
        type="button"
        className={styles.linkButton}
        onClick={() => navigate(`/meetings/${parsedMeetingId}`)}
      >
        모임 상세로 이동
      </button>
    </div>
  )
}
