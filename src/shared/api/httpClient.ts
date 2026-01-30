import { API_BASE_URL } from '@/shared/config/env'

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

type RequestOptions = {
  method?: HttpMethod
  body?: unknown
  headers?: Record<string, string>
  signal?: AbortSignal
}

type ErrorPayload = {
  message?: string
  error?: string
  detail?: string
}

export class HttpError extends Error {
  status: number
  data?: unknown

  constructor(message: string, status: number, data?: unknown) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.data = data
  }
}

let csrfTokenProvider: (() => string | null) | null = null

export function setCsrfTokenProvider(provider: () => string | null) {
  csrfTokenProvider = provider
}

function getCsrfTokenFromCookie() {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(/(?:^|; )csrf_token=([^;]*)/)
  return match ? decodeURIComponent(match[1]) : null
}

async function refreshSession() {
  const token = (csrfTokenProvider ? csrfTokenProvider() : null) ?? getCsrfTokenFromCookie()
  const headers: Record<string, string> = {}
  if (token) headers['X-CSRF-Token'] = token
  const response = await fetch(`${API_BASE_URL ?? ''}/api/v1/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
    headers,
  })
  if (!response.ok) {
    if (typeof window !== 'undefined') {
      window.location.assign('/')
    }
    return false
  }
  return true
}

function resolveErrorMessage(data: unknown, statusText: string) {
  if (data && typeof data === 'object') {
    const payload = data as ErrorPayload
    return payload.message || payload.error || payload.detail || statusText
  }
  return statusText
}

export async function request<T>(
  path: string,
  options: RequestOptions = {},
  hasRetried = false,
) {
  const { method = 'GET', body, headers, signal } = options

  const resolvedHeaders: Record<string, string> = { ...headers }

  const token = (csrfTokenProvider ? csrfTokenProvider() : null) ?? getCsrfTokenFromCookie()
  if (token) {
    resolvedHeaders['X-CSRF-Token'] = token
  }

  const hasBody = body !== undefined && body !== null
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData

  if (hasBody && !isFormData) {
    resolvedHeaders['Content-Type'] = 'application/json'
  }

  const response = await fetch(`${API_BASE_URL ?? ''}${path}`, {
    method,
    credentials: 'include',
    headers: resolvedHeaders,
    body: hasBody ? (isFormData ? (body as BodyInit) : JSON.stringify(body)) : undefined,
    signal,
  })

  const contentType = response.headers.get('content-type') || ''
  const isJson = contentType.includes('application/json')
  const data = isJson ? await response.json().catch(() => null) : null

  if (!response.ok) {
    if (
      (response.status === 401 || response.status === 403) &&
      !hasRetried &&
      !path.includes('/api/v1/auth/refresh')
    ) {
      const refreshed = await refreshSession()
      if (refreshed) {
        return request<T>(path, options, true)
      }
    }
    throw new HttpError(
      resolveErrorMessage(data, response.statusText || 'Request failed'),
      response.status,
      data,
    )
  }

  return data as T
}
