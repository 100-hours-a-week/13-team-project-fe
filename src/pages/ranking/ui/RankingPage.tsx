import styles from './RankingPage.module.css'
import { BottomNav } from '@/shared/ui/bottom-nav'

export function RankingPage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>랭킹</h1>
      </header>
      <p className={styles.note}>준비 중...</p>
      <BottomNav />
    </div>
  )
}
