/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope;

// vite-plugin-pwa injects the precache manifest here
// @ts-ignore
self.__WB_MANIFEST;

// Handle incoming push messages from the server
self.addEventListener('push', (event) => {
  let data = { title: '💰 Fenowa Reminder', body: "Don't forget to log your transactions!", url: '/transactions', icon: '/android-chrome-192x192.png', badge: '/favicon-32x32.png' };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch {
      data.body = event.data.text();
    }
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

// Open the app when user taps the notification
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
