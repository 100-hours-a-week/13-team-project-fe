import styles from './BlockedPage.module.css'
import { navigate } from '@/shared/lib/navigation'

export function BlockedPage() {
  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <span className={styles.badge}>접근 제한</span>
        <h1>계정이 비활성화되었습니다</h1>
        <p>
          계정 상태가 DELETED로 변경되어 서비스 이용이 제한됩니다.
          도움이 필요하면 운영팀에 문의해 주세요.
        </p>
        <button className={styles.home} onClick={() => navigate('/')}>홈으로</button>
      </div>
    </div>
  )
}
