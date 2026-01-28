import { createContext, useContext } from 'react'
import type { MemberProfile, MemberStatus } from '@/shared/lib/api'

type AuthContextValue = {
  member: MemberProfile | null
  status: MemberStatus | null
  loading: boolean
  refresh: () => Promise<void>
  setMember: (member: MemberProfile | null) => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

export { AuthContext, useAuth }
export type { AuthContextValue }
