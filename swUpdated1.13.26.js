/**
 * Cliff Watch - Service Worker
 * Enables offline support and push notifications
 */

const CACHE_NAME = 'cliff-watch-v1';
const CACHE_URLS = [
    '/',
    '/index.html',
    '/manifest.json',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
    'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&family=Outfit:wght@300;400;600;700&display=swap'
];

// Install event - cache essential files
self.addEventListener('install', (event) => {
    console.log('[SW] Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Caching app shell');
                return cache.addAll(CACHE_URLS);
            })
            .then(() => self.skipWaiting())
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[SW] Removing old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

/**
 * FETCH EVENT — UPDATED (ONLY CHANGE)
 * Network-first strategy for app shell
 * ArcGIS requests explicitly excluded from caching
 */
self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);

    // Always fetch ArcGIS data live
    if (
        url.hostname.includes('arcgis.com') ||
        url.hostname.includes('services.arcgis.com')
    ) {
        return;
    }

    // Network-first for navigations (HTML)
    if (
        event.request.mode === 'navigate' ||
        event.request.headers.get('accept')?.includes('text/html')
    ) {
        event.respondWith(
            fetch(event.request).catch(() => caches.match('/'))
        );
        return;
    }

    // Network-first for other assets, fallback to cache
    event.respondWith(
        fetch(event.request)
            .then((response) => response)
            .catch(() => caches.match(event.request))
    );
});

// Push notification event
self.addEventListener('push', (event) => {
    console.log('[SW] Push received:', event);

    let data = {
        title: 'Cliff Watch Alert',
        body: 'Risk level has changed',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: 'cliff-watch-alert',
        data: { url: '/' }
    };

    if (event.data) {
        try {
            data = { ...data, ...event.data.json() };
        } catch (e) {
            data.body = event.data.text();
        }
    }

    event.waitUntil(
        self.registration.showNotification(data.title, {
            body: data.body,
            icon: data.icon,
            badge: data.badge,
            tag: data.tag,
            data: data.data,
            vibrate: [200, 100, 200],
            requireInteraction: data.title.includes('High')
        })
    );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
    console.log('[SW] Notification clicked:', event);

    event.notification.close();

    const urlToOpen = event.notification.data?.url || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                for (const client of clientList) {
                    if (
                        client.url.includes(self.location.origin) &&
                        'focus' in client
                    ) {
                        return client.focus();
                    }
                }
                if (clients.openWindow) {
                    return clients.openWindow(urlToOpen);
                }
            })
    );
});

// Background sync for offline updates (future feature)
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-risk-data') {
        console.log('[SW] Background sync triggered');
        // Future functionality
    }
});

console.log('[SW] Service Worker loaded');
