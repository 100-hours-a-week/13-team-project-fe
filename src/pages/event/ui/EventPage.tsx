import styles from './EventPage.module.css'
import { BottomNav } from '@/shared/ui/bottom-nav'

export function EventPage() {
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>이벤트</h1>
      <p className={styles.note}>준비 중인 페이지예요.</p>
      <BottomNav />
    </div>
  )
}
