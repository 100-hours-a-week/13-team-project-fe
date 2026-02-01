import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import styles from './BottomNav.module.css'
import { navigate } from '@/shared/lib/navigation'

type NavItem = {
  key: 'event' | 'ranking' | 'home' | 'notification' | 'my'
  label: string
  path: string
  icon: ReactNode
}

const navItems: NavItem[] = [
  {
    key: 'event',
    label: '이벤트',
    path: '/event',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 3h10v2h2a2 2 0 0 1 2 2v4H3V7a2 2 0 0 1 2-2h2V3zm12 10H5v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6zM9 3h6v2H9V3z" />
      </svg>
    ),
  },
  {
    key: 'ranking',
    label: '랭킹',
    path: '/ranking',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 4h10v3h3v2a6 6 0 0 1-6 6h-4a6 6 0 0 1-6-6V7h3V4zm10 5V7H7v2a4 4 0 0 0 4 4h2a4 4 0 0 0 4-4zM9 20h6v-2H9v2zM5 22h14v-2H5v2z" />
      </svg>
    ),
  },
  {
    key: 'home',
    label: '홈',
    path: '/main',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3 3 10h2v9a2 2 0 0 0 2 2h4v-6h2v6h4a2 2 0 0 0 2-2v-9h2L12 3z" />
      </svg>
    ),
  },
  {
    key: 'notification',
    label: '알림',
    path: '/notification',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 22a2.5 2.5 0 0 0 2.5-2.5h-5A2.5 2.5 0 0 0 12 22zm7-6V11a7 7 0 1 0-14 0v5l-2 2v1h18v-1l-2-2z" />
      </svg>
    ),
  },
  {
    key: 'my',
    label: '마이',
    path: '/mypage',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm0 2c-4.42 0-8 2-8 4.5V21h16v-2.5c0-2.5-3.58-4.5-8-4.5z" />
      </svg>
    ),
  },
]

export function BottomNav() {
  const { pathname } = useLocation()
  const isHome = pathname === '/main'

  return (
    <nav className={styles.bottomNav}>
      {navItems.map((item) => {
        const active =
          item.key === 'home' ? isHome : pathname.startsWith(item.path)
        return (
          <button
            type="button"
            key={item.key}
            className={`${styles.navItem} ${active ? styles.navItemActive : ''}`}
            onClick={() => navigate(item.path)}
          >
            <span className={styles.navIcon}>{item.icon}</span>
            <span className={styles.navLabel}>{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
