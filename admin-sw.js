// Admin panel service worker: displays data-only pushes and opens the right admin page on tap.
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');
firebase.initializeApp({
    apiKey: "AIzaSyDZXv7nmtJ5tqSLmvrxQ1F4WuoHmBxttuY",
    authDomain: "min-el-batal.firebaseapp.com",
    projectId: "min-el-batal",
    storageBucket: "min-el-batal.firebasestorage.app",
    messagingSenderId: "743794480493",
    appId: "1:743794480493:web:74c8ef6a444e29f7a4b664"
});
var messaging = firebase.messaging();
self.addEventListener('install', function() { self.skipWaiting(); });
self.addEventListener('activate', function(e) { e.waitUntil(self.clients.claim()); });

messaging.onBackgroundMessage(function(payload) {
    if (payload.notification) return;
    var d = payload.data || {};
    return self.registration.showNotification(d.title || 'لوحة مين البطل', {
        body: d.body || '', icon: '/images/icon/app-192.png', badge: '/images/Logo-192.png',
        dir: 'rtl', lang: 'ar', tag: d.tag || undefined, data: { link: d.link || '' }
    });
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
