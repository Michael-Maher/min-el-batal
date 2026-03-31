// ============================================================
// مين البطل؟ - Service Worker (PWA + Push Notifications)
// ============================================================

importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// --- Cache Config ---
var CACHE_NAME = 'min-el-batal-v4';
var STATIC_ASSETS = [
    '/',
    '/index.html',
    '/game.js',
    '/style.css',
    '/manifest.json',
    '/images/Logo-opt.png',
    '/images/Logo-192.png',
    '/images/Logo-512.png',
    '/images/david-opt.jpg',
    '/images/george-opt.jpg',
    '/images/paul-opt.jpg',
    '/images/philomena-opt.jpg',
    '/images/level2-bg-opt.jpg',
    '/images/competitions-bg-opt.jpg',
    '/images/on_lamp-opt.png',
    '/images/off_lamp-opt.png',
    '/images/map1.jpg',
    '/images/map2-opt.jpg',
    '/images/Logo-favicon.png'
];

var CDN_ASSETS = [
    'https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css'
];

// --- Firebase Init (for background push) ---
firebase.initializeApp({
    apiKey: "AIzaSyDZXv7nmtJ5tqSLmvrxQ1F4WuoHmBxttuY",
    authDomain: "min-el-batal.firebaseapp.com",
    projectId: "min-el-batal",
    storageBucket: "min-el-batal.firebasestorage.app",
    messagingSenderId: "743794480493",
    appId: "1:743794480493:web:74c8ef6a444e29f7a4b664"
});

var messaging = firebase.messaging();

// --- Background Push Handler ---
messaging.onBackgroundMessage(function(payload) {
    var title = payload.notification ? payload.notification.title : 'مين البطل؟';
    var body = payload.notification ? payload.notification.body : 'عندك إشعار جديد!';
    var icon = '/images/Logo-192.png';

    return self.registration.showNotification(title, {
        body: body,
        icon: icon,
        badge: '/images/Logo-192.png',
        dir: 'rtl',
        lang: 'ar',
        vibrate: [200, 100, 200],
        data: payload.data || {},
        actions: [
            { action: 'open', title: 'افتح اللعبة' }
        ]
    });
});

// --- Notification Click ---
self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
            // Focus existing window if open
            for (var i = 0; i < clientList.length; i++) {
                if (clientList[i].url.includes('min-el-batal') && 'focus' in clientList[i]) {
                    return clientList[i].focus();
                }
            }
            // Otherwise open new window
            return clients.openWindow('/');
        })
    );
});

// --- Install: Cache static assets ---
self.addEventListener('install', function(event) {
    console.log('[SW] Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME).then(function(cache) {
            console.log('[SW] Caching app shell');
            // Cache static assets (ignore failures for individual files)
            return Promise.allSettled(
                STATIC_ASSETS.map(function(url) {
                    return cache.add(url).catch(function(err) {
                        console.warn('[SW] Failed to cache:', url, err);
                    });
                })
            );
        }).then(function() {
            return self.skipWaiting();
        })
    );
});

// --- Activate: Clean old caches ---
self.addEventListener('activate', function(event) {
    console.log('[SW] Activating...');
    event.waitUntil(
        caches.keys().then(function(cacheNames) {
            return Promise.all(
                cacheNames.filter(function(name) {
                    return name !== CACHE_NAME;
                }).map(function(name) {
                    console.log('[SW] Deleting old cache:', name);
                    return caches.delete(name);
                })
            );
        }).then(function() {
            return self.clients.claim();
        })
    );
});

// --- Fetch: Caching strategies ---
self.addEventListener('fetch', function(event) {
    var url = new URL(event.request.url);

    // Skip non-GET requests
    if (event.request.method !== 'GET') return;

    // Skip Firebase/Firestore API calls (always network)
    if (url.hostname.includes('firestore.googleapis.com') ||
        url.hostname.includes('firebase') ||
        url.hostname.includes('gstatic.com')) {
        return;
    }

    // CDN assets (fonts, icons): stale-while-revalidate
    if (url.hostname.includes('googleapis.com') ||
        url.hostname.includes('cdnjs.cloudflare.com') ||
        url.hostname.includes('gstatic.com')) {
        event.respondWith(
            caches.open(CACHE_NAME).then(function(cache) {
                return cache.match(event.request).then(function(cachedResponse) {
                    var fetchPromise = fetch(event.request).then(function(networkResponse) {
                        cache.put(event.request, networkResponse.clone());
                        return networkResponse;
                    }).catch(function() { return cachedResponse; });
                    return cachedResponse || fetchPromise;
                });
            })
        );
        return;
    }

    // JS/CSS files: network-first (always get latest code)
    if (url.pathname.endsWith('.js') || url.pathname.endsWith('.css') || url.pathname.endsWith('.html') || url.pathname === '/') {
        event.respondWith(
            fetch(event.request).then(function(networkResponse) {
                if (networkResponse && networkResponse.ok) {
                    var responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then(function(cache) {
                        cache.put(event.request, responseClone);
                    });
                }
                return networkResponse;
            }).catch(function() {
                // Offline: fall back to cache
                return caches.match(event.request).then(function(cachedResponse) {
                    if (cachedResponse) return cachedResponse;
                    if (event.request.mode === 'navigate') {
                        return caches.match('/index.html');
                    }
                });
            })
        );
        return;
    }

    // Images & other assets: cache-first, network fallback
    event.respondWith(
        caches.match(event.request).then(function(cachedResponse) {
            if (cachedResponse) {
                // Refresh cache in background
                fetch(event.request).then(function(networkResponse) {
                    if (networkResponse && networkResponse.ok) {
                        caches.open(CACHE_NAME).then(function(cache) {
                            cache.put(event.request, networkResponse);
                        });
                    }
                }).catch(function() {});
                return cachedResponse;
            }
            // Not in cache: fetch from network, cache it
            return fetch(event.request).then(function(networkResponse) {
                if (networkResponse && networkResponse.ok) {
                    var responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then(function(cache) {
                        cache.put(event.request, responseClone);
                    });
                }
                return networkResponse;
            }).catch(function() {
                // Offline fallback for navigation
                if (event.request.mode === 'navigate') {
                    return caches.match('/index.html');
                }
            });
        })
    );
});
