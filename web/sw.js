// Soulink service worker (v2): shows phone notifications (Web Push) and opens the right screen when tapped.
// EVERY push shows a notification. iPhone takes notifications away from an app that receives pushes without showing
// one (it did that to Soulink while people had the app open), so while you're looking at Soulink the notification
// is shown quietly and cleared after a moment instead of being skipped.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data && event.data.text() }; }
  event.waitUntil((async () => {
    // number on the Home Screen icon (iPhone 16.4+, Android, desktop Chrome)
    if (typeof data.badge === 'number' && self.navigator.setAppBadge) {
      try { if (data.badge > 0) await self.navigator.setAppBadge(data.badge); else await self.navigator.clearAppBadge(); } catch { /* not allowed */ }
    }
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const looking = wins.some((w) => w.visibilityState === 'visible' && w.focused) && data.tag !== 'test';
    const tag = data.tag || 'soulink';
    await self.registration.showNotification(data.title || 'Soulink', {
      body: data.body || '',
      icon: '/apple-touch-icon.png',
      badge: '/apple-touch-icon.png',
      tag,
      renotify: !looking,
      silent: looking,
      data: { url: data.url || '/' },
    });
    if (looking) { // you can see it in the app already: clear it again after a moment
      await new Promise((r) => setTimeout(r, 4000));
      for (const n of await self.registration.getNotifications({ tag })) n.close();
    }
  })());
});

// The browser replaced this phone's push address (it does that now and then): send the new one to Soulink,
// so notifications keep coming without anyone having to switch them on again.
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil((async () => {
    try {
      const old = event.oldSubscription;
      const key = old && old.options && old.options.applicationServerKey;
      const sub = event.newSubscription || (key ? await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }) : null);
      if (!sub || !old) return;
      const json = sub.toJSON();
      await fetch('/api/push/renew', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ oldEndpoint: old.endpoint, endpoint: json.endpoint, keys: json.keys }) });
    } catch (e) { /* the app re-sends it the next time it opens */ }
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin).href;
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) {
      if (w.url.startsWith(self.location.origin)) { await w.focus(); try { await w.navigate(url); } catch { /* older browsers */ } return; }
    }
    await self.clients.openWindow(url);
  })());
});
