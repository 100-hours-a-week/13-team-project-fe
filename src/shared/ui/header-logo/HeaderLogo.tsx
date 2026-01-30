import styles from './HeaderLogo.module.css'
import { navigate } from '@/shared/lib/navigation'

type HeaderLogoProps = {
  label?: string
  to?: string
  className?: string
}

export function HeaderLogo({ label = '모여밥', to = '/main', className }: HeaderLogoProps) {
  const classes = className ? `${styles.logo} ${className}` : styles.logo

  return (
    <button type="button" className={classes} onClick={() => navigate(to)}>
      {label}
    </button>
  )
}
