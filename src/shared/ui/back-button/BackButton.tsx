import styles from './BackButton.module.css'
import { navigate } from '@/shared/lib/navigation'

type BackButtonProps = {
  fallbackPath?: string
  ariaLabel?: string
  className?: string
}

export function BackButton({
  fallbackPath = '/main',
  ariaLabel = '뒤로가기',
  className,
}: BackButtonProps) {
  const handleBack = () => {
    if (window.history.length > 1) {
      window.history.back()
      return
    }
    navigate(fallbackPath)
  }

  const mergedClassName = [styles.button, className].filter(Boolean).join(' ')

  return (
    <button type="button" className={mergedClassName} onClick={handleBack} aria-label={ariaLabel}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M15 19l-7-7 7-7" />
      </svg>
    </button>
  )
}
