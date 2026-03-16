import { initializeApp, getApps } from 'firebase/app'
import {
  getMessaging,
  getToken,
  isSupported,
  onMessage,
  type MessagePayload,
  type Messaging,
} from 'firebase/messaging'

const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyBoE4KO1m2P0s0MEepN2ud1XZgUnDFHkCU',
  authDomain: 'moyeobab.firebaseapp.com',
  projectId: 'moyeobab',
  storageBucket: 'moyeobab.firebasestorage.app',
  messagingSenderId: '679694545247',
  appId: '1:679694545247:web:b44c26c32139876db006ea',
}

const VAPID_PUBLIC_KEY =
  'BJ7Yqd51TlJsEipXbtW_AU_YzDpgFGxmvGGVzNDOvlkpeLGlpMS1h-B77YS0uQjdPH6YQKXoq36JJSq7k6W1mIc'

function isSecureEnvironment() {
  if (typeof window === 'undefined') return false
  if (window.isSecureContext) return true
  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
}

async function getMessagingInstance(): Promise<Messaging | null> {
  if (typeof window === 'undefined') return null
  if (!('serviceWorker' in navigator)) return null
  if (!('Notification' in window)) return null
  if (!isSecureEnvironment()) return null

  const supported = await isSupported().catch(() => false)
  if (!supported) return null

  const app = getApps().length > 0 ? getApps()[0] : initializeApp(FIREBASE_CONFIG)
  return getMessaging(app)
}

async function registerServiceWorker() {
  if (typeof window === 'undefined') return null
  if (!('serviceWorker' in navigator)) return null
  return navigator.serviceWorker.register('/firebase-messaging-sw.js')
}

async function resolvePermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'denied' as NotificationPermission
  if (Notification.permission === 'granted') return 'granted' as NotificationPermission
  if (Notification.permission === 'denied') return 'denied' as NotificationPermission
  return Notification.requestPermission()
}

export async function getBrowserFcmToken(): Promise<string | null> {
  const messaging = await getMessagingInstance()
  if (!messaging) return null

  const permission = await resolvePermission()
  if (permission !== 'granted') return null

  const registration = await registerServiceWorker()
  if (!registration) return null

  try {
    const token = await getToken(messaging, {
      vapidKey: VAPID_PUBLIC_KEY,
      serviceWorkerRegistration: registration,
    })
    return token || null
  } catch {
    return null
  }
}

export async function listenForegroundMessage(
  handler: (payload: MessagePayload) => void,
): Promise<() => void> {
  const messaging = await getMessagingInstance()
  if (!messaging) {
    return () => {}
  }

  return onMessage(messaging, handler)
}
