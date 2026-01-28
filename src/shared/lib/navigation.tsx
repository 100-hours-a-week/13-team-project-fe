import { type AnchorHTMLAttributes, useEffect, useState } from 'react'

type NavigateOptions = {
  replace?: boolean
}

export function navigate(path: string, options: NavigateOptions = {}) {
  const nextPath = path.startsWith('/') ? path : `/${path}`
  if (options.replace) {
    window.history.replaceState(null, '', nextPath)
  } else {
    window.history.pushState(null, '', nextPath)
  }
  window.dispatchEvent(new PopStateEvent('popstate'))
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

export function usePathname() {
  const [pathname, setPathname] = useState(() => window.location.pathname)

  useEffect(() => {
    const handlePop = () => setPathname(window.location.pathname)
    window.addEventListener('popstate', handlePop)
    return () => window.removeEventListener('popstate', handlePop)
  }, [])

  return pathname
}

type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  to: string
}

export function Link({ to, onClick, ...rest }: LinkProps) {
  const handleClick: AnchorHTMLAttributes<HTMLAnchorElement>['onClick'] = (event) => {
    if (event.defaultPrevented) return
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    navigate(to)
    onClick?.(event)
  }

  return <a href={to} onClick={handleClick} {...rest} />
}
