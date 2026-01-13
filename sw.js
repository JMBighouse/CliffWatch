/**
 * Cliff Watch - Service Worker
 * Enables offline support and push notifications
 * 
 * Strategy:
 * - Network-first for HTML (ensures fresh content)
 * - Cache-first for static assets (performance)
 * - Network-only for ArcGIS API (real-time data)
 */

const CACHE_NAME = 'cliff-watch-v3';
const STATIC_ASSETS = [
    '/manifest.json',
    '/icon-192.png',
    '/icon-512.png',
    'https://js.arcgis.com/4.28/esri/themes/dark/main.css',
    'https://js.arcgis.com/4.28/'
];

// Install event - cache essential static files
self.addEventListener('install', (event) => {
    console.log('[SW] Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Caching static assets');
                // Use addAll with error handling for individual failures
                return Promise.allSettled(
                    STATIC_ASSETS.map(url => 
                        cache.add(url).catch(err => console.log('[SW] Failed to cache:', url))
                    )
                );
            })
            .then(() => self.skipWaiting())
    );
});

// Activate event - clean up old caches and take control immediately
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

// Fetch event - different strategies based on request type
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    
    // Skip non-GET requests
    if (event.request.method !== 'GET') return;
    
    // NETWORK ONLY: ArcGIS API requests (always need fresh real-time data)
    if (event.request.url.includes('arcgis.com') || 
        event.request.url.includes('services.arcgis.com') ||
        event.request.url.includes('services1.arcgis.com')) {
        return; // Let browser handle normally
    }
    
    // NETWORK FIRST: HTML pages (ensures users get latest version)
    if (event.request.headers.get('accept')?.includes('text/html') ||
        url.pathname === '/' ||
        url.pathname.endsWith('.html')) {
        event.respondWith(networkFirstStrategy(event.request));
        return;
    }
    
    // CACHE FIRST: Static assets (CSS, JS, images, fonts)
    event.respondWith(cacheFirstStrategy(event.request));
});

/**
 * Network-first strategy: Try network, fall back to cache
 * Used for HTML to ensure fresh content while supporting offline
 */
async function networkFirstStrategy(request) {
    try {
        const networkResponse = await fetch(request);
        
        // Cache successful responses for offline use
        if (networkResponse.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        // Network failed, try cache
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            console.log('[SW] Serving HTML from cache (offline)');
            return cachedResponse;
        }
        
        // If requesting a page and we have index.html cached, serve that
        const fallback = await caches.match('/index.html');
        if (fallback) {
            return fallback;
        }
        
        throw error;
    }
}

/**
 * Cache-first strategy: Try cache, fall back to network
 * Used for static assets for better performance
 */
async function cacheFirstStrategy(request) {
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
        return cachedResponse;
    }
    
    try {
        const networkResponse = await fetch(request);
        
        // Cache successful responses
        if (networkResponse.ok && networkResponse.type === 'basic') {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        console.log('[SW] Fetch failed for:', request.url);
        throw error;
    }
}

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
            requireInteraction: data.title.includes('Critical') || data.title.includes('High')
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
                // If app is already open, focus it
                for (const client of clientList) {
                    if (client.url.includes(self.location.origin) && 'focus' in client) {
                        return client.focus();
                    }
                }
                // Otherwise open new window
                if (clients.openWindow) {
                    return clients.openWindow(urlToOpen);
                }
            })
    );
});

// Background sync for offline report submissions (future feature)
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-risk-data') {
        console.log('[SW] Background sync triggered');
        // Could sync offline report submissions here
    }
});

// Message handler for manual cache updates
self.addEventListener('message', (event) => {
    if (event.data === 'skipWaiting') {
        self.skipWaiting();
    }
    if (event.data === 'clearCache') {
        caches.delete(CACHE_NAME).then(() => {
            console.log('[SW] Cache cleared');
        });
    }
});

console.log('[SW] Service Worker loaded - v3');
