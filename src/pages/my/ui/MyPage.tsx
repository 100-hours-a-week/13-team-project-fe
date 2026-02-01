import styles from './MyPage.module.css'
import { BackButton } from '@/shared/ui/back-button'

export function MyPage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <BackButton />
        <h1 className={styles.title}>마이</h1>
      </header>
      <p className={styles.note}>준비 중인 페이지예요.</p>
    </div>
  )
}
