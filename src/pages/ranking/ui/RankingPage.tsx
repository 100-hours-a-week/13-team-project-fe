import styles from './RankingPage.module.css'
import { BottomNav } from '@/shared/ui/bottom-nav'
import { BackButton } from '@/shared/ui/back-button'

export function RankingPage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <BackButton />
        <h1 className={styles.title}>랭킹</h1>
      </header>
      <p className={styles.note}>준비 중인 페이지예요.</p>
      <BottomNav />
    </div>
  )
}
