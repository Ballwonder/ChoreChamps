const CACHE_NAME = 'chore-champs-v4';
const FIREBASE_SDK_VERSION = '12.19.0';

self.addEventListener('notificationclick', handleNotificationClick);

try {
  importScripts(
    `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-app-compat.js`,
    `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-messaging-compat.js`
  );

  const firebaseConfig = {
    apiKey: 'AIzaSyA9lQBztjMJQ8omnLf4UlWPiJQAUW2U7Y4',
    authDomain: 'chore-champs-2fbea.firebaseapp.com',
    databaseURL: 'https://chore-champs-2fbea-default-rtdb.firebaseio.com',
    projectId: 'chore-champs-2fbea',
    storageBucket: 'chore-champs-2fbea.firebasestorage.app',
    messagingSenderId: '160633035011',
    appId: '1:160633035011:web:a42457ea1e50f4e35b7136'
  };

  const firebaseApp = firebase.apps.length ? firebase.app() : firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging(firebaseApp);

  messaging.onBackgroundMessage((payload) => {
    // Firebase automatically displays notification payloads. Only render our
    // own notification for data-only messages to avoid showing the same push twice.
    if (payload.notification) return;

    const data = payload.data || {};
    const title = data.title || 'Chore Champs';
    const body = data.body || '';
    const targetUrl = resolveNotificationTarget(data.path);
    const messageId = data.messageId || payload.messageId;

    return self.registration.showNotification(title, {
      body,
      icon: new URL('./icons/ChoreChamps-logo.png', self.registration.scope).href,
      badge: new URL('./icons/ChoreChamps-logo.png', self.registration.scope).href,
      tag: messageId ? `chore-champs-${messageId}` : undefined,
      data: { targetUrl }
    });
  });
} catch (error) {
  console.warn('[Chore Champs] Firebase Messaging background support could not be loaded.', error);
}

function resolveNotificationTarget(path) {
  const scopeUrl = new URL(self.registration.scope);
  if (typeof path !== 'string' || !path.trim() || path.startsWith('//') || /[\\\u0000-\u001f]/.test(path)) {
    return scopeUrl.href;
  }

  try {
    const target = new URL(path, scopeUrl);
    if (
      target.origin !== scopeUrl.origin ||
      !['http:', 'https:'].includes(target.protocol) ||
      target.username ||
      target.password ||
      !target.pathname.startsWith(scopeUrl.pathname)
    ) {
      return scopeUrl.href;
    }
    return target.href;
  } catch (error) {
    return scopeUrl.href;
  }
}

function handleNotificationClick(event) {
  event.notification.close();
  event.stopImmediatePropagation();
  const notificationData = event.notification.data || {};
  const firebaseMessage = notificationData.FCM_MSG || {};
  const messageData = firebaseMessage.data || notificationData.data || {};
  const targetUrl = resolveNotificationTarget(
    notificationData.targetUrl || notificationData.path || messageData.path
  );

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (windowClients) => {
      for (const client of windowClients) {
        const clientUrl = new URL(client.url);
        const scopeUrl = new URL(self.registration.scope);
        if (clientUrl.origin === scopeUrl.origin && clientUrl.pathname.startsWith(scopeUrl.pathname)) {
          await client.focus();
          if (client.url !== targetUrl && 'navigate' in client) {
            await client.navigate(targetUrl);
          }
          return;
        }
      }
      return clients.openWindow(targetUrl);
    })
  );
}

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/ChoreChamps-logo.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .catch(() => {})
  );

  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );

  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Shared Chore Champs data must always come from Firebase,
  // never from the offline cache.
  if (url.hostname.endsWith('firebaseio.com')) {
    return;
  }

  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          const clone = response.clone();

          caches
            .open(CACHE_NAME)
            .then((cache) => cache.put(event.request, clone))
            .catch(() => {});

          return response;
        })
        .catch(() => cached);

      return cached || networkFetch;
    })
  );
});
