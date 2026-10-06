self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('jarvis-pc-finder-v1').then((cache) =>
      cache.addAll(['/', '/index.html', '/manifest.webmanifest', '/favicon.svg']),
    ),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== 'jarvis-pc-finder-v1')
          .map((key) => caches.delete(key)),
      ),
    ),
  );
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const request = event.request;
  const isNavigation = request.mode === 'navigate';
  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open('jarvis-pc-finder-v1').then((cache) => cache.put(request, copy));
        return response;
      })
      .catch(() =>
        caches.match(request).then(
          (cached) => cached || (isNavigation ? caches.match('/') : Response.error()),
        ),
      ),
  );
});

self.addEventListener('push', (event) => {
  const payload = event.data?.json?.() ?? {
    title: 'JARVIS PC Finder',
    body: 'Une nouvelle annonce correspond à vos critères.',
  };
  event.waitUntil(
    self.registration.showNotification(payload.title || 'JARVIS PC Finder', {
      body: payload.body || 'Une nouvelle annonce correspond à vos critères.',
      tag: payload.tag || 'jarvis-alert',
      data: { url: payload.url || '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const target = event.notification.data?.url || '/';
      const existing = clients.find((client) => 'focus' in client);
      return existing ? existing.focus() : self.clients.openWindow(target);
    }),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'TEST_NOTIFICATION') {
    event.waitUntil(
      self.registration.showNotification('JARVIS PC Finder', {
        body: 'La veille démo est active. Un nouveau signal vous attend.',
        tag: 'jarvis-test',
      }),
    );
  }
});