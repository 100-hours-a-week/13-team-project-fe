import styles from './MainPage.module.css'
import { useState } from 'react'
import { useAuth } from '@/app/providers/AuthProvider'
import { ApiError, logout, withdrawMember } from '@/shared/lib/api'
import { navigate } from '@/shared/lib/navigation'

export function MainPage() {
  const { member, setMember } = useAuth()
  const [withdrawing, setWithdrawing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLogout = async () => {
    try {
      await logout()
    } finally {
      setMember(null)
      navigate('/')
    }
  }

  const handleWithdraw = async () => {
    const confirmed = window.confirm('정말 회원 탈퇴하시겠어요? 탈퇴 후 복구할 수 없어요.')
    if (!confirmed) return
    setWithdrawing(true)
    setError(null)
    try {
      await withdrawMember()
      setMember(null)
      navigate('/')
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          setError('이미 탈퇴 처리된 계정입니다.')
          return
        }
        if (err.status === 401) {
          setError('로그인이 필요합니다.')
          return
        }
      }
      setError('탈퇴 처리에 실패했어요. 잠시 후 다시 시도해 주세요.')
    } finally {
      setWithdrawing(false)
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>맛침반 메인</h1>
          <p>모임이 시작되면 여기서 모든 흐름을 확인할 수 있어요.</p>
        </div>
        <div className={styles.actions}>
          <button className={styles.logout} onClick={handleLogout}>
            로그아웃
          </button>
          <button className={styles.withdraw} onClick={handleWithdraw} disabled={withdrawing}>
            {withdrawing ? '탈퇴 처리 중...' : '회원 탈퇴'}
          </button>
        </div>
      </header>

      {error ? <p className={styles.error}>{error}</p> : null}

      <section className={styles.hero}>
        <div className={styles.profileCard}>
          <div>
            <span className={styles.badge}>ACTIVE</span>
            <h2>{member?.nickname ?? '멤버'}님, 환영합니다</h2>
            <p>오늘의 모임 추천을 준비하고 있어요.</p>
          </div>
          <div className={styles.profileMeta}>
            <div>
              <strong>ID</strong>
              <span>{member?.memberId ?? '-'}</span>
            </div>
            <div>
              <strong>가입일</strong>
              <span>{member?.createdAt ? new Date(member.createdAt).toLocaleDateString() : '-'}</span>
            </div>
          </div>
        </div>

        <div className={styles.panelGrid}>
          <div className={styles.panel}>
            <h3>오늘의 추천</h3>
            <p>취향 기반 추천이 여기에 표시됩니다.</p>
          </div>
          <div className={styles.panel}>
            <h3>모임 일정</h3>
            <p>예정된 모임을 확인하세요.</p>
          </div>
          <div className={styles.panel}>
            <h3>팀 피드백</h3>
            <p>최근 리뷰와 제안을 모아볼 수 있어요.</p>
          </div>
        </div>
      </section>
    </div>
  )
}
