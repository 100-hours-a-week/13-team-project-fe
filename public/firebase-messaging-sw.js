/* global importScripts, firebase, self, clients */

importScripts('https://www.gstatic.com/firebasejs/11.2.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/11.2.0/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey: 'AIzaSyBoE4KO1m2P0s0MEepN2ud1XZgUnDFHkCU',
  authDomain: 'moyeobab.firebaseapp.com',
  projectId: 'moyeobab',
  storageBucket: 'moyeobab.firebasestorage.app',
  messagingSenderId: '679694545247',
  appId: '1:679694545247:web:b44c26c32139876db006ea',
})

const messaging = firebase.messaging()
const DEFAULT_ICON = '/icon.png'

messaging.onBackgroundMessage((payload) => {
  const data = payload?.data ?? {}
  const title = payload?.notification?.title ?? data.title ?? '알림'
  const body = payload?.notification?.body ?? data.content ?? '새로운 알림이 도착했어요.'
  const deeplinkPath = data.deeplinkPath || '/notification'

  self.registration.showNotification(title, {
    body,
    icon: DEFAULT_ICON,
    data: {
      deeplinkPath,
    },
  })
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const deeplinkPath = event.notification?.data?.deeplinkPath || '/notification'
  const destination = new URL(deeplinkPath, self.location.origin).toString()

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url === destination && 'focus' in client) {
          return client.focus()
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(destination)
      }

      return undefined
    }),
  )
})
