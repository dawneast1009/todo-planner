// 서비스 워커에 붙는 알림 처리 (vite.config.ts의 workbox.importScripts로 들어간다).
// 서버(scripts/notify.ts)는 FCM data 메시지로 { title, body, tag, url }을 보낸다.

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { data: { body: event.data ? event.data.text() : '' } };
  }
  // FCM은 보낸 data를 payload.data 안에 넣어 준다
  const d = payload.data || payload.notification || payload;
  const title = d.title || '할 일·일정';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: d.body || '',
      tag: d.tag || undefined,
      icon: 'icon-192.png',
      badge: 'icon-192.png',
      data: { url: d.url || self.registration.scope },
    }),
  );
});

// 알림을 누르면 열려 있는 앱으로 가고, 없으면 새로 연다
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || self.registration.scope;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.startsWith(self.registration.scope) && 'focus' in c) return c.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
