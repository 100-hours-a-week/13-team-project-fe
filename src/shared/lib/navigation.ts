import { useEffect, useState } from 'react'

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
