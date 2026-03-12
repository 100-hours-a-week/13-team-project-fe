import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import s from './AboutPage.module.css'

function Icon({ d, size = 32, className }: { d: string; size?: number; className?: string }) {
  return (
    <svg
      className={className ?? s.cardIcon}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
    </svg>
  )
}

const icons = {
  search: 'M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14ZM21 21l-4.35-4.35',
  chat: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10Z',
  wallet: 'M21 12V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5Zm-5 1a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z',
  sparkle: 'M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8L12 2Z',
  swipe: 'M18 8V6a2 2 0 0 0-4 0v2M14 8V4a2 2 0 0 0-4 0v4M10 8V6a2 2 0 0 0-4 0v6l-1.8-1.8a2 2 0 0 0-2.83 2.83L7 18.66A6 6 0 0 0 11.24 21H14a6 6 0 0 0 6-6V10a2 2 0 0 0-4 0v-2',
  receipt: 'M4 2v20l3-2 3 2 3-2 3 2 3-2 3 2V2l-3 2-3-2-3 2-3-2-3 2-3-2ZM8 10h8M8 14h5',
  briefcase: 'M16 8V6a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2M2 10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v2ZM4 12v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6',
  heart: 'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78Z',
  flag: 'M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1ZM4 22v-7',
  users: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  check: 'M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4 12 14.01l-3-3',
} as const

export function AboutPage() {
  useEffect(() => {
    const prevTitle = document.title
    document.title = '모여밥 — 팀 점심, 더 이상 고민하지 마세요'

    const setMeta = (attr: string, key: string, content: string) => {
      let el = document.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null
      const prev = el?.getAttribute('content') ?? null
      if (!el) {
        el = document.createElement('meta')
        el.setAttribute(attr, key)
        document.head.appendChild(el)
      }
      el.setAttribute('content', content)
      return { el, prev, created: prev === null }
    }

    const metas = [
      setMeta('name', 'description', '판교 테크노밸리 팀 점심 모임 플랫폼. AI 맛집 추천, 스와이프 투표, 자동 정산까지.'),
      setMeta('property', 'og:title', '모여밥 — 팀 점심, 더 이상 고민하지 마세요'),
      setMeta('property', 'og:description', '판교 테크노밸리 팀 점심 모임 플랫폼. AI 맛집 추천, 스와이프 투표, 자동 정산까지.'),
      setMeta('property', 'og:type', 'website'),
      setMeta('property', 'og:url', 'https://moyeobab.com/about'),
    ]

    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null
    const prevCanonical = canonical?.getAttribute('href') ?? null
    const canonicalCreated = !canonical
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.setAttribute('rel', 'canonical')
      document.head.appendChild(canonical)
    }
    canonical.setAttribute('href', 'https://moyeobab.com/about')

    const jsonLd = document.createElement('script')
    jsonLd.type = 'application/ld+json'
    jsonLd.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: '모여밥',
      url: 'https://moyeobab.com',
      description: '판교 테크노밸리 팀 점심 모임 플랫폼',
      applicationCategory: 'FoodService',
      operatingSystem: 'Web',
    })
    document.head.appendChild(jsonLd)

    return () => {
      document.title = prevTitle
      for (const { el, prev, created } of metas) {
        if (created) el.remove()
        else if (prev !== null) el.setAttribute('content', prev)
      }
      if (canonicalCreated) canonical?.remove()
      else if (prevCanonical !== null) canonical?.setAttribute('href', prevCanonical)
      jsonLd.remove()
    }
  }, [])

  return (
    <div className={s.page}>
      {/* Nav */}
      <nav className={s.nav}>
        <span className={s.logo}>모여밥</span>
        <Link to="/" className={s.navLink}>서비스 바로가기</Link>
      </nav>

      {/* Hero */}
      <section className={s.hero}>
        <div className={s.heroInner}>
          <h1 className={s.heroTitle}>모여밥</h1>
          <p className={s.heroTagline}>팀 점심, 더 이상 고민하지 마세요</p>
          <p className={s.heroDesc}>
            AI가 추천하는 맛집, 스와이프 한 번으로 결정하는 투표,
            자동으로 끝나는 정산까지. 팀 점심의 모든 과정을 하나로 연결합니다.
          </p>
          <Link to="/" className={s.heroCta}>시작하기</Link>
        </div>
      </section>

      {/* 문제 정의 */}
      <section className={s.sectionAlt}>
        <h2 className={s.sectionTitle}>이런 고민, 매일 하고 계시죠?</h2>
        <div className={s.grid}>
          <div className={s.card}>
            <Icon d={icons.search} />
            <h3 className={s.cardTitle}>오늘 뭐 먹지?</h3>
            <p className={s.cardDesc}>
              매일 반복되는 메뉴 선택. 검색해봐도 리뷰는 많고 결정은 안 되고.
            </p>
          </div>
          <div className={s.card}>
            <Icon d={icons.chat} />
            <h3 className={s.cardTitle}>취향 조율이 어려워요</h3>
            <p className={s.cardDesc}>
              한식, 중식, 양식... 사람마다 다른 취향을
              하나로 모으는 건 쉽지 않습니다.
            </p>
          </div>
          <div className={s.card}>
            <Icon d={icons.wallet} />
            <h3 className={s.cardTitle}>정산이 번거로워요</h3>
            <p className={s.cardDesc}>
              누가 얼마를 냈는지, 누구에게 보내야 하는지.
              식사 후에도 일이 남습니다.
            </p>
          </div>
        </div>
      </section>

      {/* 해결 방식 */}
      <section className={s.section}>
        <h2 className={s.sectionTitle}>모여밥이 해결해요</h2>
        <div className={s.grid}>
          <div className={s.card}>
            <Icon d={icons.sparkle} />
            <h3 className={s.cardTitle}>AI 맞춤 추천</h3>
            <p className={s.cardDesc}>
              팀원들의 취향과 위치를 분석해 최적의 맛집을 추천합니다.
              더 이상 검색하지 않아도 됩니다.
            </p>
          </div>
          <div className={s.card}>
            <Icon d={icons.swipe} />
            <h3 className={s.cardTitle}>스와이프 투표</h3>
            <p className={s.cardDesc}>
              좋으면 오른쪽, 아니면 왼쪽. 간단한 스와이프로
              모두의 의견을 빠르게 모읍니다.
            </p>
          </div>
          <div className={s.card}>
            <Icon d={icons.receipt} />
            <h3 className={s.cardTitle}>자동 정산</h3>
            <p className={s.cardDesc}>
              영수증 촬영 한 번이면 OCR이 자동으로 금액을 인식하고,
              각자 먹은 메뉴에 따라 정산합니다.
            </p>
          </div>
        </div>
      </section>

      {/* 사용 흐름 */}
      <section className={s.sectionAlt}>
        <h2 className={s.sectionTitle}>5분 안에 점심이 결정돼요</h2>
        <div className={s.flow}>
          <div className={s.step}>
            <div className={s.stepIcon}>
              <Icon d={icons.users} size={22} className={s.stepSvg} />
            </div>
            <p className={s.stepTitle}>모임 생성</p>
            <p className={s.stepDesc}>날짜와 인원을 정하고 팀원을 초대하세요.</p>
          </div>
          <div className={s.stepArrow} aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </div>
          <div className={s.step}>
            <div className={s.stepIcon}>
              <Icon d={icons.sparkle} size={22} className={s.stepSvg} />
            </div>
            <p className={s.stepTitle}>맛집 추천</p>
            <p className={s.stepDesc}>AI가 팀 취향에 맞는 맛집을 골라드려요.</p>
          </div>
          <div className={s.stepArrow} aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </div>
          <div className={s.step}>
            <div className={s.stepIcon}>
              <Icon d={icons.swipe} size={22} className={s.stepSvg} />
            </div>
            <p className={s.stepTitle}>스와이프 투표</p>
            <p className={s.stepDesc}>마음에 드는 식당을 스와이프로 골라주세요.</p>
          </div>
          <div className={s.stepArrow} aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </div>
          <div className={s.step}>
            <div className={s.stepIcon}>
              <Icon d={icons.check} size={22} className={s.stepSvg} />
            </div>
            <p className={s.stepTitle}>정산 완료</p>
            <p className={s.stepDesc}>식사 후 영수증만 찍으면 자동 정산됩니다.</p>
          </div>
        </div>
      </section>

      {/* 대상 사용자 */}
      <section className={s.section}>
        <h2 className={s.sectionTitle}>이런 분들을 위해 만들었어요</h2>
        <div className={s.tags}>
          <div className={s.tag}>
            <Icon d={icons.briefcase} size={22} />
            직장 동료와 점심을 함께하는 분
          </div>
          <div className={s.tag}>
            <Icon d={icons.heart} size={22} />
            친구, 연인, 가족과 외식하는 분
          </div>
          <div className={s.tag}>
            <Icon d={icons.flag} size={22} />
            모임을 자주 주선하는 분
          </div>
        </div>
      </section>

      {/* 서비스 현황 */}
      <section className={s.sectionAlt}>
        <h2 className={s.sectionTitle}>서비스 현황</h2>
        <div className={s.statusGrid}>
          <div className={s.statusItem}>
            <div className={s.statusDot} />
            <span className={s.statusText}>현재 Beta 서비스 운영 중</span>
          </div>
          <div className={s.statusItem}>
            <div className={s.statusDot} />
            <span className={s.statusText}>판교 테크노밸리 지역 중심</span>
          </div>
          <div className={s.statusItem}>
            <div className={s.statusDot} />
            <span className={s.statusText}>카카오 소셜 로그인 지원</span>
          </div>
          <div className={s.statusItem}>
            <div className={s.statusDot} />
            <span className={s.statusText}>모바일 웹 최적화</span>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={s.footer}>
        <div className={s.footerLinks}>
          <Link to="/" className={s.footerLink}>홈으로 돌아가기</Link>
          <Link to="/terms" className={s.footerLink}>이용약관</Link>
        </div>
        <p className={s.footerEmail}>문의: gguip7554@naver.com</p>
        <p className={s.footerCopy}>&copy; 2025 모여밥. All rights reserved.</p>
      </footer>
    </div>
  )
}
