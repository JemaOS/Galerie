/*
 * Copyright (C) 2025 Jema Technology
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

// Service Worker for JemaOS Gallery PWA
//
// Update strategy: a new deployment reaches users WITHOUT a manual version bump.
//   - Documents (index.html, navigations): network-first, cache only as an
//     offline fallback.
//   - Static assets (scripts/, styles/, libs/, fonts/, icons/): stale-while-
//     revalidate. The cached copy is served immediately, then refreshed from the
//     network in the background and written back to the cache. The next load is
//     therefore up to date even when CACHE_NAME is unchanged.
//
// CACHE_NAME still exists to namespace the cache and purge the previous one on
// activate. Bumping it is no longer required for content changes to land, but it
// is still the way to force an immediate service-worker update (and thus the
// in-app "update available" prompt) when the worker logic itself changes.
const CACHE_NAME = 'jemaos-gallery-v1.6.15';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './manifest-dark.json',
  './scripts/loader.js',
  './scripts/i18n.js',
  './styles/fonts.css',
  './styles/main.css',
  './styles/grid.css',
  './styles/fullscreen.css',
  './styles/responsive.css',
  './styles/pdf-viewer.css',
  './styles/pdf-text-editor.css',
  './styles/audio-player.css',
  './styles/video-player.css',
  './styles/annotation.css',
  './scripts/main.js',
  './scripts/utils.js',
  './scripts/file-handler.js',
  './scripts/ui-controller.js',
  './scripts/fullscreen-viewer.js',
  './scripts/tiled-image-renderer.js',
  './scripts/tile-worker.js',
  './scripts/pdf-viewer.js',
  './scripts/pdf-text-editor.js',
  './scripts/audio-player.js',
  './scripts/video-player.js',
  './scripts/annotation-manager.js',
  './libs/pdf.min.js',
  './libs/pdf.worker.min.js',
  './libs/pdf-lib.min.js',
  './fonts/roboto-latin.woff2',
  './fonts/roboto-latin-ext.woff2',
  './fonts/roboto-italic-latin.woff2',
  './fonts/material-icons.woff2',
  './icons/icon.svg',
  './icons/icon-192x192.svg',
  './icons/icon-512x512.svg'
];

// Install event - cache resources
self.addEventListener('install', event => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching app shell...');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('[SW] App shell cached successfully');
      })
      .catch(error => {
        console.error('[SW] Failed to cache app shell:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[SW] Service worker activated');
      return globalThis.clients.claim();
    })
  );
});

// Fetch event - serve cached content when offline
self.addEventListener('fetch', event => {
  // Skip cross-origin requests and jema-extension requests
  if (!event.request.url.startsWith(self.location.origin) || 
      event.request.url.startsWith('jema-extension://')) {
    return;
  }
  if (event.request.method !== 'GET') {
    return;
  }

  // Navigations and HTML: network-first, so a new deployment is picked up as
  // soon as the user opens the app (cache is only a fallback when offline).
  const isDocument = event.request.mode === 'navigate' ||
    event.request.destination === 'document' ||
    event.request.url.endsWith('/') ||
    event.request.url.endsWith('index.html');

  // The dedicated file-handler route is served stale-while-revalidate so opening
  // a file is instant: the cached app shell is used immediately and refreshed in
  // the background. The '/' route stays network-first for update discovery.
  let isFileRoute = false;
  try {
    const path = new URL(event.request.url).pathname;
    isFileRoute = path === '/open' || path === '/open/';
  } catch (error) {
    isFileRoute = false;
  }

  if (isDocument && !isFileRoute) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // Static assets: stale-while-revalidate. Start the background refresh here so
  // it can be tied to the event's lifetime, then serve the cached copy if we
  // have one. This is what makes a new deployment reach the user on the next
  // load even when CACHE_NAME was not bumped manually -- the old cache-first
  // strategy kept serving stale JS/CSS and never surfaced an update.
  const refresh = refreshFromNetwork(event.request);
  event.waitUntil(refresh.catch(() => {}));
  event.respondWith(serveStale(event.request, refresh));
});

async function networkFirst(request) {
  try {
    const response = await fetch(request, { cache: 'no-cache' });
    if (response && response.status === 200 && response.type === 'basic') {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    if (request.mode === 'navigate') {
      return caches.match('./index.html');
    }
    return new Response('Service Unavailable', { status: 503, statusText: 'Service Unavailable' });
  }
}

// Fetch a fresh copy and keep the cache up to date. Revalidates against the
// server (conditional request) so an unchanged asset costs a cheap 304.
async function refreshFromNetwork(request) {
  const response = await fetch(request, { cache: 'no-cache' });
  if (response && response.status === 200 && response.type === 'basic') {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  }
  return response;
}

// Serve the cached copy immediately when present; otherwise wait for the network
// response. Offline with no cache falls back to a 503.
async function serveStale(request, refresh) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }
  try {
    const response = await refresh;
    if (response) {
      return response;
    }
  } catch (error) {
    console.error('[SW] Fetch failed:', error);
  }
  if (request.mode === 'navigate') {
    return caches.match('./index.html');
  }
  return new Response('Service Unavailable', { status: 503, statusText: 'Service Unavailable' });
}

// Handle file share target
self.addEventListener('message', event => {
  // Security: Verify the origin of the received message
  // Only accept messages from the same origin or trusted origins
  const allowedOrigins = [
    self.location.origin,
    // Add any additional trusted origins here if needed
  ];
  
  if (!allowedOrigins.includes(event.origin)) {
    console.warn('[SW] Security: Rejected message from untrusted origin:', event.origin);
    return;
  }
  
  if (event.data?.type === 'SKIP_WAITING') {
    globalThis.skipWaiting();
  }
  
  if (event.data?.type === 'GET_VERSION') {
    event.ports[0].postMessage({version: CACHE_NAME});
  }
  
  if (event.data?.type === 'SHARE_FILES') {
    // Handle shared files
    const { files, title, text } = event.data;
    console.log('[SW] Received shared files:', files);
    
    // Store shared files in cache for the app to access
    caches.open(CACHE_NAME).then(cache => {
      cache.put('/shared-files', new Response(JSON.stringify({
        files,
        title,
        text,
        timestamp: Date.now()
      })));
    });
  }
});

// Background sync for file operations
self.addEventListener('sync', event => {
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

function doBackgroundSync() {
  // Handle background file operations
  return new Promise((resolve, reject) => {
    try {
      console.log('[SW] Background sync completed');
      resolve('sync-completed');
    } catch (error) {
      console.error('[SW] Background sync failed:', error);
      reject(error);
    }
  });
}

// Push notifications for file updates
self.addEventListener('push', event => {
  const options = {
    body: event.data ? event.data.text() : 'New files available',
    icon: './icons/icon-192x192.svg',
    badge: './icons/icon-72x72.svg',
    tag: 'gallery-notification',
    actions: [
      {
        action: 'open',
        title: 'Open Gallery'
      },
      {
        action: 'close',
        title: 'Close'
      }
    ]
  };

  event.waitUntil(
    globalThis.registration.showNotification('Galerie', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'open') {
    event.waitUntil(
      clients.openWindow('./')
    );
  }
});

// Periodic background sync (if supported)
if (globalThis.registration && 'periodicSync' in globalThis.registration) {
  self.addEventListener('periodicsync', event => {
    if (event.tag === 'gallery-sync') {
      event.waitUntil(syncGalleryData());
    }
  });
}

function syncGalleryData() {
  return new Promise((resolve, reject) => {
    try {
      console.log('[SW] Periodic sync completed');
      resolve('gallery-synced');
    } catch (error) {
      console.error('[SW] Periodic sync failed:', error);
      reject(error);
    }
  });
}

// File system access (for supported browsers)
self.addEventListener('fileSystemAccess', event => {
  if (event.data) {
    console.log('[SW] File system access granted');
  }
});