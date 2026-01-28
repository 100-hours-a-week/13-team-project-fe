import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { ApiError, getMemberMe, initCsrfToken, type MemberProfile, type MemberStatus } from '@/shared/lib/api'

type AuthContextValue = {
  member: MemberProfile | null
  status: MemberStatus | null
  loading: boolean
  refresh: () => Promise<void>
  setMember: (member: MemberProfile | null) => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

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

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
