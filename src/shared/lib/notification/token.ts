import { getBrowserFcmToken } from './firebase'

const DEVICE_KEY_STORAGE_KEY = 'moyeobab.notification.deviceKey'
const TOKEN_STORAGE_KEY = 'moyeobab.notification.fcmToken'

type NotificationTokenUpsertPayload = {
  fcmToken: string
  deviceKey?: string
  userAgent?: string
}

type NotificationTokenDeactivatePayload = {
  fcmToken: string
}

type UpsertTokenFn = (payload: NotificationTokenUpsertPayload) => Promise<unknown>
type DeactivateTokenFn = (payload: NotificationTokenDeactivatePayload) => Promise<unknown>

function getStoredValue(key: string) {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(key)
}

function setStoredValue(key: string, value: string) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(key, value)
}

function resolveDeviceKey() {
  const existing = getStoredValue(DEVICE_KEY_STORAGE_KEY)
  if (existing) return existing

  const generated =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `device-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

  setStoredValue(DEVICE_KEY_STORAGE_KEY, generated)
  return generated
}

function storeToken(token: string) {
  setStoredValue(TOKEN_STORAGE_KEY, token)
}

export function getStoredNotificationToken() {
  return getStoredValue(TOKEN_STORAGE_KEY)
}

export async function upsertBrowserNotificationToken(upsertToken: UpsertTokenFn) {
  const fcmToken = await getBrowserFcmToken()
  if (!fcmToken) return null

  const deviceKey = resolveDeviceKey()
  await upsertToken({
    fcmToken,
    deviceKey,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
  })

  storeToken(fcmToken)
  return fcmToken
}

export async function deactivateStoredNotificationToken(deactivateToken: DeactivateTokenFn) {
  const fcmToken = getStoredNotificationToken()
  if (!fcmToken) return

  await deactivateToken({ fcmToken })
}
