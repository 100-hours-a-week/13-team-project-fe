export type MemberStatus = 'PENDING' | 'ONBOARDING' | 'ACTIVE' | 'DELETED'

export type MemberPreferences = {
  allergyGroups: Array<{ code: string; label: string; emoji: string }>
  preferredCategories: Array<{ code: string; label: string; emoji: string }>
  dislikedCategories: Array<{ code: string; label: string; emoji: string }>
}

export type MemberProfile = {
  memberId: number
  nickname: string
  profileImageUrl: string | null
  thumbnailImageUrl: string | null
  status: MemberStatus
  createdAt: string
  updatedAt: string
  preferences?: MemberPreferences
}

export type AgreementSummary = {
  agreementId: number
  type: string
  title: string
  version: string
  isRequired: boolean
  summary: string[]
}

export type AgreementList = {
  required: AgreementSummary[]
}

export type AgreementConsentData = {
  userStatus: MemberStatus
}

export type AgreementDetail = {
  agreementId: number
  title: string
  content: string
}

export type PreferenceChoice = {
  code: string
  label: string
  emoji: string
}

export type PreferenceChoices = {
  allergyGroups: PreferenceChoice[]
  categories: PreferenceChoice[]
}

export type PreferencesSavedData = {
  userStatus: MemberStatus
}

export type ConsentPayload = {
  agreements: Array<{ agreementId: number; agreed: boolean }>
}

export type PreferencesPayload = {
  allergyGroup: string[]
  preferredCategories: string[]
  dislikedCategories: string[]
}

type ApiEnvelope<T> = {
  message: string
  data: T
  detail?: string
}

export class ApiError extends Error {
  status: number
  detail?: string

  constructor(message: string, status: number, detail?: string) {
    super(message)
    this.status = status
    this.detail = detail
  }
}

type ApiRequestOptions = RequestInit & {
  skipRefresh?: boolean
}

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')
let refreshPromise: Promise<boolean> | null = null
let csrfPromise: Promise<void> | null = null

function getCookie(name: string) {
  if (typeof document === 'undefined') return null
  const target = `${name}=`
  const parts = document.cookie.split(';')
  for (const part of parts) {
    const cookie = part.trim()
    if (cookie.startsWith(target)) {
      return decodeURIComponent(cookie.slice(target.length))
    }
  }
  return null
}

async function parseJson<T>(response: Response): Promise<T | null> {
  if (response.status === 204) return null
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text) as T
  } catch {
    return null
  }
}

async function refreshSession(): Promise<boolean> {
  if (refreshPromise) return refreshPromise
  refreshPromise = (async () => {
    try {
      await request('/api/v1/auth/refresh', {
        method: 'POST',
        skipRefresh: true,
      })
      return true
    } catch {
      return false
    } finally {
      refreshPromise = null
    }
  })()
  return refreshPromise
}

async function ensureCsrfToken(): Promise<void> {
  if (getCookie('csrf_token')) return
  if (csrfPromise) return csrfPromise
  csrfPromise = (async () => {
    try {
      await fetch(`${API_BASE}/api/csrf`, {
        credentials: 'include',
      })
    } finally {
      csrfPromise = null
    }
  })()
  return csrfPromise
}

export async function initCsrfToken() {
  await ensureCsrfToken()
}

async function request<T>(path: string, options: ApiRequestOptions = {}) {
  const url = `${API_BASE}${path}`
  const method = (options.method ?? 'GET').toString().toUpperCase()
  const headers = new Headers(options.headers ?? {})

  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json')
  }

  const hasBody = Boolean(options.body)
  if (hasBody && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  if (method !== 'GET' && method !== 'HEAD') {
    if (!headers.has('X-CSRF-Token')) {
      await ensureCsrfToken()
      const csrfToken = getCookie('csrf_token')
      if (csrfToken) {
        headers.set('X-CSRF-Token', csrfToken)
      }
    }
  }

  const response = await fetch(url, {
    ...options,
    method,
    headers,
    credentials: 'include',
  })

  if ((response.status === 401 || response.status === 403) && !options.skipRefresh) {
    const refreshed = await refreshSession()
    if (refreshed) {
      return request<T>(path, { ...options, skipRefresh: true })
    }
  }

  const body = await parseJson<ApiEnvelope<T> | T>(response)

  if (!response.ok) {
    const envelope = body as ApiEnvelope<unknown> | null
    const message = envelope?.message ?? response.statusText ?? 'Request failed'
    const detail = envelope?.detail
    throw new ApiError(message, response.status, detail)
  }

  if (body && typeof body === 'object' && 'data' in body) {
    return (body as ApiEnvelope<T>).data
  }

  return body as T
}

export function startKakaoLogin() {
  window.location.href = `${API_BASE}/api/v1/auth/kakao/login`
}

export async function getMemberMe() {
  return request<MemberProfile>('/api/v1/member/me')
}

export async function getAgreements() {
  return request<AgreementList>('/api/v1/onboarding/agreements')
}

export async function getAgreementDetail(agreementId: number) {
  return request<AgreementDetail>(`/api/v1/onboarding/agreements/${agreementId}`)
}

export async function consentAgreements(payload: ConsentPayload) {
  return request<AgreementConsentData>('/api/v1/onboarding/agreements/consent', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function getPreferenceChoices() {
  return request<PreferenceChoices>('/api/v1/onboarding/preferences/choices')
}

export async function savePreferences(payload: PreferencesPayload) {
  return request<PreferencesSavedData>('/api/v1/onboarding/preferences', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function logout() {
  return request('/api/v1/auth/logout', {
    method: 'POST',
  })
}

export async function withdrawMember() {
  return request('/api/v1/member/me', {
    method: 'DELETE',
  })
}
