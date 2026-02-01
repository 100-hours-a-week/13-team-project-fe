import { useEffect, useMemo, useRef, useState } from 'react'
import styles from './MyPage.module.css'
import {
  ApiError,
  getPreferenceChoices,
  logout,
  savePreferences,
  startKakaoLogin,
  withdrawMember,
  type PreferenceChoice,
} from '@/shared/lib/api'
import { useAuth } from '@/app/providers/auth-context'
import { navigate } from '@/shared/lib/navigation'
import kakaoLoginButton from '@/assets/kakao_login_medium_narrow.png'
import { BottomNav } from '@/shared/ui/bottom-nav'

const dummyReviews = [
  {
    id: 'review-1',
    title: '청담 한정식',
    date: '2025-01-10',
    rating: 5,
    content: '정말 맛있었어요! 다음에 또 올게요.',
  },
  {
    id: 'review-2',
    title: '이탈리안 키친',
    date: '2025-01-05',
    rating: 4,
    content: '파스타가 훌륭했어요.',
  },
]

const dummyCoupons = [
  {
    id: 'coupon-1',
    title: '모임 예약 10% 할인',
    description: '팀 모임 예약 시 즉시 사용 가능',
    expiresAt: '2025-03-30',
  },
  {
    id: 'coupon-2',
    title: '신규 맛집 리뷰 쿠폰',
    description: '리뷰 작성 시 자동 지급',
    expiresAt: '2025-04-15',
  },
]

function toggleItem(list: string[], code: string) {
  if (list.includes(code)) {
    return list.filter((item) => item !== code)
  }
  return [...list, code]
}

type TabKey = 'profile' | 'reviews' | 'coupons'

type PrefState = {
  allergy: string[]
  preferred: string[]
  disliked: string[]
}

export function MyPage() {
  const { member, setMember } = useAuth()
  const [tab, setTab] = useState<TabKey>('profile')
  const [allergyGroups, setAllergyGroups] = useState<PreferenceChoice[]>([])
  const [categories, setCategories] = useState<PreferenceChoice[]>([])
  const [pref, setPref] = useState<PrefState>({
    allergy: [],
    preferred: [],
    disliked: [],
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const initializedRef = useRef(false)

  const displayName = member?.nickname ?? '회원'
  const profileInitial = displayName.trim().charAt(0) || 'M'

  useEffect(() => {
    if (!member) {
      setLoading(false)
      return
    }

    if (member.preferences && !initializedRef.current) {
      setPref({
        allergy: member.preferences.allergyGroups.map((item) => item.code),
        preferred: member.preferences.preferredCategories.map((item) => item.code),
        disliked: member.preferences.dislikedCategories.map((item) => item.code),
      })
      initializedRef.current = true
    }

    const load = async () => {
      setLoading(true)
      try {
        const data = await getPreferenceChoices()
        setAllergyGroups(data.allergyGroups)
        setCategories(data.categories)
      } catch {
        setError('취향 선택지를 불러오지 못했어요.')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [member])

  const allergySet = useMemo(() => new Set(pref.allergy), [pref.allergy])
  const preferredSet = useMemo(() => new Set(pref.preferred), [pref.preferred])
  const dislikedSet = useMemo(() => new Set(pref.disliked), [pref.disliked])

  const handleToggle = (key: keyof PrefState, code: string) => {
    setSuccess(null)
    setError(null)
    setPref((prev) => ({
      ...prev,
      [key]: toggleItem(prev[key], code),
    }))
  }

  const handleDislikedToggle = (code: string) => {
    setSuccess(null)
    setError(null)
    setPref((prev) => ({
      ...prev,
      preferred: prev.preferred.filter((item) => item !== code),
      disliked: toggleItem(prev.disliked, code),
    }))
  }

  const handlePreferredToggle = (code: string) => {
    setSuccess(null)
    setError(null)
    setPref((prev) => ({
      ...prev,
      disliked: prev.disliked.filter((item) => item !== code),
      preferred: toggleItem(prev.preferred, code),
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    setSuccess(null)
    setError(null)
    try {
      const data = await savePreferences({
        allergyGroup: pref.allergy,
        preferredCategories: pref.preferred,
        dislikedCategories: pref.disliked,
      })
      if (member && data?.userStatus) {
        setMember({ ...member, status: data.userStatus })
      }
      setSuccess('취향이 저장되었습니다.')
    } catch {
      setError('취향 저장에 실패했어요. 잠시 후 다시 시도해 주세요.')
    } finally {
      setSaving(false)
    }
  }

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
    }
  }

  if (!member) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <h1>마이페이지</h1>
        </header>
        <section className={styles.card}>
          <div className={styles.loginGate}>
            <h2>로그인 후 이용할 수 있어요</h2>
            <p>회원 정보와 취향 설정을 확인하려면 로그인해 주세요.</p>
            <button type="button" className={styles.kakaoButton} onClick={startKakaoLogin}>
              <img src={kakaoLoginButton} alt="카카오 로그인" />
            </button>
          </div>
        </section>
        <BottomNav />
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>마이페이지</h1>
        <button className={styles.logout} onClick={handleLogout}>
          로그아웃
        </button>
      </header>

      <section className={styles.profileCard}>
        <div className={styles.avatar}>
          {member.profileImageUrl ? (
            <img src={member.profileImageUrl} alt={`${displayName} 프로필`} />
          ) : (
            <span>{profileInitial}</span>
          )}
        </div>
        <div className={styles.profileInfo}>
          <h2>{displayName}님</h2>
          <p>오늘도 즐거운 모임 되세요!</p>
        </div>
      </section>

      <nav className={styles.tabs}>
        <button
          className={tab === 'profile' ? styles.tabActive : ''}
          onClick={() => setTab('profile')}
          type="button"
        >
          회원정보
        </button>
        <button
          className={tab === 'reviews' ? styles.tabActive : ''}
          onClick={() => setTab('reviews')}
          type="button"
        >
          내 리뷰
        </button>
        <button
          className={tab === 'coupons' ? styles.tabActive : ''}
          onClick={() => setTab('coupons')}
          type="button"
        >
          내 쿠폰
        </button>
      </nav>

      <section className={styles.card}>
        {tab === 'profile' ? (
          <>
            <header className={styles.sectionHeader}>
              <h3>알레르기 유발 식품</h3>
              <span>해당 항목 선택</span>
            </header>
            {loading ? <p className={styles.state}>선택지를 불러오는 중...</p> : null}
            <div className={styles.chipGrid}>
              {allergyGroups.map((item) => (
                <button
                  key={item.code}
                  className={`${styles.chip} ${allergySet.has(item.code) ? styles.active : ''}`}
                  onClick={() => handleToggle('allergy', item.code)}
                  type="button"
                >
                  <span>{item.emoji}</span>
                  {item.label}
                </button>
              ))}
            </div>

            <header className={styles.sectionHeader}>
              <h3>선호 카테고리</h3>
              <span>복수 선택 가능</span>
            </header>
            <div className={styles.chipGrid}>
              {categories.map((item) => (
                <button
                  key={item.code}
                  className={`${styles.chip} ${preferredSet.has(item.code) ? styles.active : ''}`}
                  onClick={() => handlePreferredToggle(item.code)}
                  type="button"
                >
                  <span>{item.emoji}</span>
                  {item.label}
                </button>
              ))}
            </div>

            <header className={styles.sectionHeader}>
              <h3>비선호 카테고리</h3>
              <span>복수 선택 가능</span>
            </header>
            <div className={styles.chipGrid}>
              {categories.map((item) => (
                <button
                  key={item.code}
                  className={`${styles.chip} ${dislikedSet.has(item.code) ? styles.disliked : ''}`}
                  onClick={() => handleDislikedToggle(item.code)}
                  type="button"
                >
                  <span>{item.emoji}</span>
                  {item.label}
                </button>
              ))}
            </div>

            <p className={styles.hint}>선호/비선호 중복 선택 시 기존 선택이 해제됩니다.</p>

            {error ? <p className={styles.error}>{error}</p> : null}
            {success ? <p className={styles.success}>{success}</p> : null}

            <button className={styles.save} onClick={handleSave} disabled={saving}>
              {saving ? '저장 중...' : '저장'}
            </button>
          </>
        ) : null}

        {tab === 'reviews' ? (
          <div className={styles.list}>
            {dummyReviews.map((review) => (
              <article key={review.id} className={styles.listItem}>
                <div className={styles.listHeader}>
                  <strong>{review.title}</strong>
                  <span className={styles.rating}>{'★'.repeat(review.rating)}</span>
                </div>
                <p>{review.content}</p>
                <time>{review.date}</time>
              </article>
            ))}
          </div>
        ) : null}

        {tab === 'coupons' ? (
          <div className={styles.list}>
            {dummyCoupons.map((coupon) => (
              <article key={coupon.id} className={styles.listItem}>
                <div className={styles.listHeader}>
                  <strong>{coupon.title}</strong>
                  <span className={styles.badge}>사용 가능</span>
                </div>
                <p>{coupon.description}</p>
                <time>만료 {coupon.expiresAt}</time>
              </article>
            ))}
          </div>
        ) : null}
      </section>

      <div className={styles.bottomActions}>
        <button className={styles.withdraw} onClick={handleWithdraw}>
          회원 탈퇴
        </button>
      </div>
      <BottomNav />
    </div>
  )
}
