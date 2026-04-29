/* ============================================================
   Pickleball Pairing Tool — Service Worker
   Handles: offline caching, push notifications
   ============================================================ */

const CACHE_NAME = 'pb-pairs-v1';
const CORE_ASSETS = [
  './pairing.html',
  './css/pairing.css'
];

// ── Install: pre-cache core assets ──────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

// ── Activate: clean up old caches ───────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch: network-first for HTML, cache-first for assets ───
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // CDN resources — network only (don't cache third-party scripts)
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async cache => {
      try {
        const response = await fetch(event.request);
        if (response.ok) cache.put(event.request, response.clone());
        return response;
      } catch {
        const cached = await cache.match(event.request);
        return cached || new Response('Offline', { status: 503 });
      }
    })
  );
});

// ── Push: show notification ──────────────────────────────────
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data?.json() || {}; } catch { data = { title: 'Pickleball', body: event.data?.text() || '' }; }

  event.waitUntil(
    self.registration.showNotification(data.title || 'Pickleball Pairing', {
      body: data.body || '',
      icon: data.icon || './icon-192.png',
      badge: data.badge || './icon-192.png',
      tag: data.tag || 'court-assignment',
      renotify: true,
      vibrate: [200, 100, 200],
      data: { url: data.url || './' }
    })
  );
});

// ── Message from page: show a notification ───────────────────
self.addEventListener('message', event => {
  if (event.data?.type === 'show-notification') {
    const { title, body, tag } = event.data;
    self.registration.showNotification(title || 'Pickleball Pairing', {
      body: body || '',
      icon: './icon-192.png',
      tag: tag || 'court-assignment',
      renotify: true,
      vibrate: [200, 100, 200]
    });
  }
});

// ── Notification click: focus/open the app ──────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (client.url.includes('pairing') && 'focus' in client) return client.focus();
      }
      return clients.openWindow(event.notification.data?.url || './');
    })
  );
});
