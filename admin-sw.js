// Admin panel service worker: always displays data-only pushes (no Firebase SDK handler, see sw.js)
// and opens the right admin page on tap.
self.addEventListener('install', function() { self.skipWaiting(); });
self.addEventListener('activate', function(e) { e.waitUntil(self.clients.claim()); });

self.addEventListener('push', function(event) {
    var d = {};
    try { d = (event.data && event.data.json() || {}).data || {}; } catch (e) {}
    event.waitUntil(self.registration.showNotification(d.title || 'لوحة مين البطل', {
        body: d.body || '', icon: '/images/icon/app-192.png', badge: '/images/Logo-192.png',
        dir: 'rtl', lang: 'ar', tag: d.tag || undefined, renotify: !!d.tag, data: { link: d.link || '' }
    }));
});

self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    var raw = (event.notification.data && event.notification.data.link) || '';
    var link = {};
    try { link = raw ? JSON.parse(raw) : {}; } catch (e) {}
    var hash = link.page ? '#' + link.page + (link.id ? '/' + link.id : '') : '';
    event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(list) {
        for (var i = 0; i < list.length; i++) {
            if (list[i].url.indexOf('/admin.html') >= 0 && 'focus' in list[i]) {
                list[i].postMessage({ type: 'admin-notif-open', link: link });
                return list[i].focus();
            }
        }
        return clients.openWindow('/admin.html' + hash);
    }));
});
