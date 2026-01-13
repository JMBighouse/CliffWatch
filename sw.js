/**
 * Cliff Watch - Service Worker (HOTFIX UNBRICK)
 * Purpose: clear stale caches and force fresh network loads.
 */

const CACHE_NAME = 'cliff-watch-hotfix-20260113';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Delete ALL caches (unbrick)
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // Always fetch ArcGIS live
  const url = new URL(event.request.url);
  if (url.hostname.includes('arcgis.com') || url.hostname.includes('services.arcgis.com')) {
    return;
  }

  // Network-first for everything
  event.respondWith(fetch(event.request));
});

console.log('[SW] Hotfix SW loaded');
