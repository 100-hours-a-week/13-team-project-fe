import { useEffect, useMemo, useState } from 'react'
import styles from './PreferencesPage.module.css'
import {
  getPreferenceChoices,
  savePreferences,
  startKakaoLogin,
  type PreferenceChoice,
} from '@/shared/lib/api'
import kakaoLoginButton from '@/assets/kakao_login_medium_narrow.png'
import { useAuth } from '@/app/providers/auth-context'
import { navigate } from '@/shared/lib/navigation'

function toggleItem(list: string[], code: string) {
  if (list.includes(code)) {
    return list.filter((item) => item !== code)
  }
  return [...list, code]
}

export function PreferencesPage() {
  const { member, setMember, refresh } = useAuth()
  const displayName = member?.nickname ?? '회원'
  const profileInitial = displayName.trim().charAt(0) || 'M'
  const [allergyGroups, setAllergyGroups] = useState<PreferenceChoice[]>([])
  const [categories, setCategories] = useState<PreferenceChoice[]>([])
  const [selectedAllergy, setSelectedAllergy] = useState<string[]>([])
  const [preferred, setPreferred] = useState<string[]>([])
  const [disliked, setDisliked] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!member) {
      setLoading(false)
      return
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

  const handleAllergyToggle = (code: string) => {
    setSelectedAllergy((prev) => toggleItem(prev, code))
  }

  const handlePreferredToggle = (code: string) => {
    setDisliked((prev) => prev.filter((item) => item !== code))
    setPreferred((prev) => toggleItem(prev, code))
  }

  const handleDislikedToggle = (code: string) => {
    setPreferred((prev) => prev.filter((item) => item !== code))
    setDisliked((prev) => toggleItem(prev, code))
  }

  const preferredSet = useMemo(() => new Set(preferred), [preferred])
  const dislikedSet = useMemo(() => new Set(disliked), [disliked])
  const allergySet = useMemo(() => new Set(selectedAllergy), [selectedAllergy])

  const handleSubmit = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const data = await savePreferences({
        allergyGroup: selectedAllergy,
        preferredCategories: preferred,
        dislikedCategories: disliked,
      })
      if (member && data?.userStatus) {
        setMember({ ...member, status: data.userStatus })
      }
      await refresh()
      navigate('/main')
    } catch {
      setError('취향 저장에 실패했어요. 잠시 후 다시 시도해 주세요.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        {member ? (
          <div className={styles.profile}>
            {member.profileImageUrl ? (
              <img src={member.profileImageUrl} alt={`${displayName} 프로필`} />
            ) : (
              <div className={styles.profileFallback}>{profileInitial}</div>
            )}
          </div>
        ) : null}
        <div>
          <h1>{member ? `${displayName}님의 취향 설정` : '취향 설정'}</h1>
          <p>더 정확한 추천을 위해 알려주세요.</p>
        </div>
      </header>

      <section className={styles.card}>
        {!member ? (
          <div className={styles.loginGate}>
            <h2>로그인 후 취향을 설정해 주세요</h2>
            <p>카카오 로그인 후 맞춤 추천을 위한 설문을 진행할 수 있어요.</p>
            <button type="button" className={styles.kakaoButton} onClick={startKakaoLogin}>
              <img src={kakaoLoginButton} alt="카카오 로그인" />
            </button>
          </div>
        ) : null}

        {member ? (
          <>
            {loading && <p className={styles.state}>선택지를 준비 중입니다...</p>}
            {error && <p className={styles.error}>{error}</p>}

            <div className={styles.section}>
              <h3>알레르기 그룹 선택</h3>
              <p>해당되는 항목을 모두 선택해 주세요.</p>
              <div className={styles.chipGrid}>
                {allergyGroups.map((item) => (
                  <button
                    key={item.code}
                    className={`${styles.chip} ${allergySet.has(item.code) ? styles.active : ''}`}
                    onClick={() => handleAllergyToggle(item.code)}
                    type="button"
                  >
                    <span>{item.emoji}</span>
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.section}>
              <h3>선호 카테고리</h3>
              <p>좋아하는 카테고리를 선택해 주세요.</p>
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
            </div>

            <div className={styles.section}>
              <h3>비선호 카테고리</h3>
              <p>피하고 싶은 카테고리를 선택해 주세요.</p>
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
            </div>

            <button
              className={styles.submit}
              onClick={handleSubmit}
              disabled={submitting}
            >
              취향 저장하고 완료하기
            </button>
          </>
        ) : null}
      </section>
    </div>
  )
}
