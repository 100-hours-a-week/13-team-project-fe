import styles from './LandingPage.module.css'
import { startKakaoLogin } from '@/shared/lib/api'
import kakaoLogin from '@/assets/kakao_login_large_wide.png'
import servicePreview from '@/assets/servicePreview.png'

const features = [
  {
    title: '맞춤 추천',
    description: '알레르기와 취향을 반영해 모두가 만족할 식당을 제안해요.',
    icon: '🍽️',
  },
  {
    title: '스와이프 투표',
    description: '스와이프로 간편하게 의견을 모아 Top3 식당이 결정돼요.',
    icon: '👍',
  },
  {
    title: '자동 정산',
    description: '영수증을 업로드하면 정산을 도와드려요.',
    icon: '🧾',
  },
]

const steps = [
  {
    title: '모임 생성 & 초대',
    description: '모임 코드를 공유해 팀원을 초대해요.',
  },
  {
    title: '스와이프로 투표',
    description: '후보 식당을 빠르게 골라요.',
  },
  {
    title: '식사 후 정산',
    description: '영수증을 업로드하면 정산을 도와드려요.',
  },
  {
    title: '리뷰 작성',
    description: '다른 사람들을 위한 후기를 남겨요.',
  },
]

export function LandingPage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}></header>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <h1 className={styles.title}>모여밥</h1>
          <p className={styles.subtitle}>식당을 5분 안에 결정해요.</p>
          <p className={styles.heroLead}>
            알레르기와 취향을 반영해 실패없는 맛집을 빠르게 추천해요.
          </p>
        </div>
        <div className={styles.heroMedia}>
          <figure className={styles.mediaFrame}>
            <img className={styles.previewImage} src={servicePreview} alt="모여밥 서비스 미리보기" />
          </figure>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionKicker}>WHY</span>
          <h2 className={styles.sectionTitle}>모임 식사가 쉬워지는 이유</h2>
          <p className={styles.sectionLead}>
            한 명이 고민하지 않게, 모두가 참여하는 프로세스를 만들었어요.
          </p>
        </div>
        <div className={styles.featureList}>
          {features.map((feature) => (
            <div key={feature.title} className={styles.featureCard}>
              <div className={styles.featureIcon} aria-hidden>
                {feature.icon}
              </div>
              <div>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionKicker}>HOW</span>
          <h2 className={styles.sectionTitle}>이렇게 사용해요</h2>
          <p className={styles.sectionLead}>모임 생성부터 정산까지 하나의 흐름으로 이어집니다.</p>
        </div>
        <ol className={styles.stepList}>
          {steps.map((step, index) => (
            <li key={step.title} className={styles.stepItem}>
              <span className={styles.stepNumber}>{index + 1}</span>
              <div>
                <h4>{step.title}</h4>
                <p>{step.description}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <div className={styles.floatingCta}>
        <button className={styles.kakaoCta} onClick={startKakaoLogin} type="button">
          <img className={styles.kakaoCtaImage} src={kakaoLogin} alt="카카오로 3초 만에 시작하기" />
        </button>
      </div>
    </div>
  )
}
