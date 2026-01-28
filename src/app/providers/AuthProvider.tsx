import { type PropsWithChildren, useCallback, useEffect, useMemo, useState } from 'react'
import { ApiError, getMemberMe, initCsrfToken, type MemberProfile } from '@/shared/lib/api'
import { AuthContext, type AuthContextValue } from '@/app/providers/auth-context'

export function AuthProvider({ children }: PropsWithChildren) {
  const [member, setMember] = useState<MemberProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const profile = await getMemberMe()
      setMember(profile)
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        setMember(null)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    initCsrfToken().catch(() => {})
    refresh()
  }, [refresh])

  const value = useMemo<AuthContextValue>(
    () => ({
      member,
      status: member?.status ?? null,
      loading,
      refresh,
      setMember,
    }),
    [member, loading, refresh],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
