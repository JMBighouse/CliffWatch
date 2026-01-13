/**
 * Cliff Watch - Service Worker (FINAL)
 * Network-first loading with limited offline fallback.
 * All ArcGIS data is always fetched live.
 */

const CACHE_NAME = 'cliff-watch-final-v1';
const STATIC_ASSETS = [
  '/manifest.json'
];

// Install: cache only non-HTML static assets
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => k !== CACHE_NAME && caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: network-first, never cache HTML or ArcGIS data
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Always fetch ArcGIS live
  if (url.hostname.includes('arcgis.com') ||
      url.hostname.includes('services.arcgis.com')) {
    return;
  }

  // Network-first for everything else
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
