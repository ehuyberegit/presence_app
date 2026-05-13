'use strict';

self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || '🔔 Présence', {
      body: data.body || "Qu'est-ce qui occupait ton esprit à cet instant ?",
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [200, 100, 200],
      requireInteraction: false,
      tag: 'presence-ping',
      data: { time: data.time || Date.now() },
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const pingTime = event.notification.data?.time || Date.now();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin)) {
          client.postMessage({ type: 'PING', time: pingTime });
          return client.focus();
        }
      }
      return clients.openWindow('/?ping=' + pingTime);
    })
  );
});
