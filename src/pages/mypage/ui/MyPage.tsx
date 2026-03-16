import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { deactivateNotificationToken } from '@/entities/notification'
import { deactivateStoredNotificationToken } from '@/shared/lib/notification/token'
import { getMyReviews, type ReviewItem } from '@/entities/review'
import { useAuth } from '@/app/providers/auth-context'
import { navigate } from '@/shared/lib/navigation'
import kakaoLoginButton from '@/assets/kakao_login_medium_narrow.png'
import { BottomNav } from '@/shared/ui/bottom-nav'

function toggleItem(list: string[], code: string) {
  if (list.includes(code)) {
    return list.filter((item) => item !== code)
  }
  return [...list, code]
}

type TabKey = 'profile' | 'reviews'

type PrefState = {
  allergy: string[]
  preferred: string[]
  disliked: string[]
}

export function MyPage() {
  const { member, setMember, refresh } = useAuth()
  const memberId = member?.memberId ?? null
  const [tab, setTab] = useState<TabKey>(() => {
    const query = new URLSearchParams(window.location.search)
    return query.get('tab') === 'reviews' ? 'reviews' : 'profile'
  })
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
  const [reviews, setReviews] = useState<ReviewItem[]>([])
  const [reviewsCursor, setReviewsCursor] = useState<number | null>(null)
  const [reviewsHasNext, setReviewsHasNext] = useState(false)
  const [reviewsLoading, setReviewsLoading] = useState(false)
  const [reviewsLoadingMore, setReviewsLoadingMore] = useState(false)
  const [reviewsError, setReviewsError] = useState<string | null>(null)
  const [reviewsInitialized, setReviewsInitialized] = useState(false)
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
      await refresh()
      setSuccess('취향이 저장되었습니다.')
    } catch {
      setError('취향 저장에 실패했어요. 잠시 후 다시 시도해 주세요.')
    } finally {
      setSaving(false)
    }
  }

  const handleLogout = async () => {
    try {
      await deactivateStoredNotificationToken(deactivateNotificationToken).catch(() => {})
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

  const loadInitialReviews = useCallback(async () => {
    setReviewsLoading(true)
    setReviewsError(null)
    try {
      const response = await getMyReviews(undefined, 10)
      setReviews(response.items ?? [])
      setReviewsCursor(response.nextCursor)
      setReviewsHasNext(response.hasNext)
    } catch {
      setReviewsError('내 리뷰를 불러오지 못했어요.')
    } finally {
      setReviewsInitialized(true)
      setReviewsLoading(false)
    }
  }, [])

  const loadMoreReviews = useCallback(async () => {
    if (!reviewsHasNext || reviewsCursor === null || reviewsLoadingMore) return
    setReviewsLoadingMore(true)
    setReviewsError(null)
    try {
      const response = await getMyReviews(reviewsCursor, 10)
      setReviews((prev) => [...prev, ...(response.items ?? [])])
      setReviewsCursor(response.nextCursor)
      setReviewsHasNext(response.hasNext)
    } catch {
      setReviewsError('리뷰를 더 불러오지 못했어요.')
    } finally {
      setReviewsLoadingMore(false)
    }
  }, [reviewsCursor, reviewsHasNext, reviewsLoadingMore])

  useEffect(() => {
    if (memberId === null) return
    setReviews([])
    setReviewsCursor(null)
    setReviewsHasNext(false)
    setReviewsError(null)
    setReviewsInitialized(false)
  }, [memberId])

  useEffect(() => {
    if (tab !== 'reviews') return
    if (reviewsInitialized) return
    void loadInitialReviews()
  }, [loadInitialReviews, reviewsInitialized, tab])

  if (!member) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <div className={styles.titleRow}>
            <h1>마이페이지</h1>
          </div>
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
        <div className={styles.titleRow}>
          <h1>마이페이지</h1>
        </div>
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
          <>
            {reviewsLoading ? <p className={styles.state}>리뷰를 불러오는 중...</p> : null}
            {reviewsError ? <p className={styles.error}>{reviewsError}</p> : null}
            {!reviewsLoading && reviews.length === 0 ? (
              <p className={styles.state}>작성한 리뷰가 아직 없어요.</p>
            ) : null}
            {reviews.length > 0 ? (
              <div className={styles.list}>
                {reviews.map((item) => (
                  <button
                    key={item.reviewId}
                    type="button"
                    className={styles.listItemButton}
                    onClick={() => navigate(`/reviews/${item.reviewId}`)}
                  >
                    <article className={styles.listItem}>
                      <div className={styles.listHeader}>
                        <strong>{item.restaurantName}</strong>
                      </div>
                      <div className={styles.ratingStars} aria-label={`별점 ${item.rating}점`}>
                        {Array.from({ length: 5 }, (_, index) =>
                          index < item.rating ? '★' : '☆',
                        ).join('')}
                      </div>
                      <p>{item.content}</p>
                      <time>{item.createdAt.slice(0, 10)}</time>
                    </article>
                  </button>
                ))}
              </div>
            ) : null}

            {reviewsHasNext ? (
              <button
                className={styles.save}
                onClick={() => {
                  void loadMoreReviews()
                }}
                disabled={reviewsLoadingMore}
              >
                {reviewsLoadingMore ? '불러오는 중...' : '더보기'}
              </button>
            ) : null}

            {reviewsError && !reviewsLoading ? (
              <button
                className={styles.save}
                onClick={() => {
                  void loadInitialReviews()
                }}
              >
                다시 시도
              </button>
            ) : null}
          </>
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
