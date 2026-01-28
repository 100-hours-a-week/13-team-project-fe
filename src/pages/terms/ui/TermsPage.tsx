import { useEffect, useMemo, useState } from 'react'
import styles from './TermsPage.module.css'
import {
  consentAgreements,
  getAgreementDetail,
  getAgreements,
  startKakaoLogin,
  type AgreementDetail,
  type AgreementSummary,
} from '@/shared/lib/api'
import kakaoLoginButton from '@/assets/kakao_login_medium_narrow.png'
import { useAuth } from '@/app/providers/AuthProvider'
import { navigate } from '@/shared/lib/navigation'

export function TermsPage() {
  const { member, setMember } = useAuth()
  const [agreements, setAgreements] = useState<AgreementSummary[]>([])
  const [checked, setChecked] = useState<Record<number, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [detail, setDetail] = useState<AgreementDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)

  useEffect(() => {
    if (!member) {
      setLoading(false)
      return
    }
    const load = async () => {
      setLoading(true)
      try {
        const data = await getAgreements()
        setAgreements(data.required)
        const initial: Record<number, boolean> = {}
        data.required.forEach((item) => {
          initial[item.agreementId] = false
        })
        setChecked(initial)
      } catch {
        setError('약관 정보를 불러오지 못했어요.')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [member])

  const allRequiredChecked = useMemo(
    () => agreements.length > 0 && agreements.every((item) => checked[item.agreementId]),
    [agreements, checked],
  )

  const toggleAgreement = (agreementId: number) => {
    setChecked((prev) => ({
      ...prev,
      [agreementId]: !prev[agreementId],
    }))
  }

  const toggleAll = () => {
    const nextValue = !allRequiredChecked
    const updated: Record<number, boolean> = {}
    agreements.forEach((item) => {
      updated[item.agreementId] = nextValue
    })
    setChecked(updated)
  }

  const openDetail = async (agreementId: number) => {
    setDetailOpen(true)
    setDetailLoading(true)
    try {
      const data = await getAgreementDetail(agreementId)
      setDetail(data)
    } catch {
      setDetail(null)
    } finally {
      setDetailLoading(false)
    }
  }

  const closeDetail = () => {
    setDetailOpen(false)
  }

  const handleSubmit = async () => {
    if (!allRequiredChecked) return
    setSubmitting(true)
    setError(null)
    try {
      const data = await consentAgreements({
        agreements: agreements.map((item) => ({
          agreementId: item.agreementId,
          agreed: Boolean(checked[item.agreementId]),
        })),
      })
      if (member && data?.userStatus) {
        setMember({ ...member, status: data.userStatus })
      }
      navigate('/preferences')
    } catch {
      setError('동의 처리에 실패했어요. 잠시 후 다시 시도해 주세요.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>이용약관 동의</h1>
          <p>서비스 이용을 위해 필수 약관에 동의해 주세요.</p>
        </div>
      </header>

      <section className={styles.card}>
        {!member ? (
          <div className={styles.loginGate}>
            <h2>로그인 후 계속 진행해 주세요</h2>
            <p>카카오 로그인 후 약관 동의와 취향 설정을 진행할 수 있어요.</p>
            <button type="button" className={styles.kakaoButton} onClick={startKakaoLogin}>
              <img src={kakaoLoginButton} alt="카카오 로그인" />
            </button>
          </div>
        ) : null}

        {member ? (
          <>
            <div className={styles.allToggle}>
              <label>
                <input type="checkbox" checked={allRequiredChecked} onChange={toggleAll} />
                필수 약관 전체 동의
              </label>
            </div>

            {loading && <p className={styles.state}>약관을 불러오는 중...</p>}
            {error && <p className={styles.error}>{error}</p>}

            <div className={styles.list}>
              {agreements.map((item) => (
                <div key={item.agreementId} className={styles.item}>
                  <label className={styles.itemLabel}>
                    <input
                      type="checkbox"
                      checked={Boolean(checked[item.agreementId])}
                      onChange={() => toggleAgreement(item.agreementId)}
                    />
                    <div>
                      <strong>{item.title}</strong>
                      <span>버전 {item.version}</span>
                    </div>
                  </label>
                  <button
                    className={styles.detailButton}
                    type="button"
                    onClick={() => openDetail(item.agreementId)}
                  >
                    자세히 보기
                  </button>
                  {item.summary?.length ? (
                    <ul>
                      {item.summary.map((summary, index) => (
                        <li key={`${item.agreementId}-${index}`}>{summary}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ))}
            </div>

            <button
              className={styles.submit}
              disabled={!allRequiredChecked || submitting}
              onClick={handleSubmit}
            >
              동의하고 계속하기
            </button>
          </>
        ) : null}
      </section>

      {detailOpen ? (
        <div className={styles.modalOverlay} onClick={closeDetail}>
          <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
            <header>
              <h3>{detail?.title ?? '약관 상세'}</h3>
              <button type="button" onClick={closeDetail}>
                닫기
              </button>
            </header>
            <div className={styles.modalBody}>
              {detailLoading ? (
                <p>불러오는 중...</p>
              ) : (
                <p>{detail?.content ?? '약관 내용을 불러오지 못했어요.'}</p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
