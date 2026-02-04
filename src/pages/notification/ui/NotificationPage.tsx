import styles from './NotificationPage.module.css'
import { BottomNav } from '@/shared/ui/bottom-nav'

export function NotificationPage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>알림</h1>
      </header>
      <p className={styles.note}>준비 중...</p>
      <BottomNav />
    </div>
  )
}
