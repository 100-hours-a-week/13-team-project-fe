import styles from './MyPage.module.css'

export function MyPage() {
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>마이</h1>
      <p className={styles.note}>준비 중인 페이지예요.</p>
    </div>
  )
}
