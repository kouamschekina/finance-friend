/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

declare const self: ServiceWorkerGlobalScope;

// Precache all static assets produced by the build (JS chunks, CSS, HTML, icons).
// After the first online visit these are all available offline.
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// SPA shell fallback — any navigation request (page refresh, direct URL) that
// isn't a file request gets served the cached index.html so React Router takes
// over. This is what makes refreshing /transactions offline work.
registerRoute(
  new NavigationRoute(
    new CacheFirst({ cacheName: 'fenowa-shell' }),
    { denylist: [/^\/_/, /\/[^/?]+\.[^/]+$/] }
  )
);

// Runtime cache for same-origin JS/CSS chunks not covered by precache manifest.
// StaleWhileRevalidate: serve from cache instantly, update in background.
registerRoute(
  ({ url, request }) =>
    url.origin === self.location.origin &&
    (request.destination === 'script' || request.destination === 'style'),
  new StaleWhileRevalidate({ cacheName: 'fenowa-runtime' })
);

// Cache-first for images and fonts
registerRoute(
  ({ request }) => request.destination === 'image' || request.destination === 'font',
  new CacheFirst({
    cacheName: 'fenowa-assets',
    plugins: [new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 30 * 24 * 60 * 60 })],
  })
);

// Network-first for Supabase API — 3s timeout then fall back to cached response
registerRoute(
  ({ url }) => url.hostname.includes('supabase.co'),
  new NetworkFirst({
    cacheName: 'fenowa-api',
    networkTimeoutSeconds: 3,
    plugins: [new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 24 * 60 * 60 })],
  })
);

// Stale-while-revalidate for Google Fonts
registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
  new StaleWhileRevalidate({ cacheName: 'fenowa-fonts' })
);

// Handle incoming Web Push notifications
self.addEventListener('push', (event) => {
  let data = {
    title: '💰 Fenowa Reminder',
    body: "Don't forget to log your transactions!",
    url: '/transactions',
    icon: '/android-chrome-192x192.png',
    badge: '/favicon-32x32.png',
  };

  if (event.data) {
    try { data = { ...data, ...event.data.json() }; }
    catch { data.body = event.data.text(); }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      badge: data.badge,
      tag: 'fenowa-reminder',
      data: { url: data.url },
    } as NotificationOptions)
  );
});

// Open app to /transactions when user taps notification
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? '/transactions';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          (client as WindowClient).navigate(url);
          client.focus();
          return;
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
