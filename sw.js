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
// IMPORTANT: bump CACHE_NAME on every deploy that changes any precached asset
// (index.html, styles/, scripts/, libs/, ...). The fetch handler serves static
// assets cache-first, so without a bump the browser keeps serving the previous
// versions. Changing this string also makes the browser detect a new worker and
// offer the in-app "update available" prompt.
const CACHE_NAME = 'jemaos-gallery-v1.6.0';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
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

  event.respondWith(isDocument ? networkFirst(event.request) : cacheFirst(event.request));
});

async function networkFirst(request) {
  try {
    const response = await fetch(request);
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

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }
  try {
    const response = await fetch(request);
    if (response && response.status === 200 && response.type === 'basic') {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.error('[SW] Fetch failed:', error);
    if (request.mode === 'navigate') {
      return caches.match('./index.html');
    }
    return new Response('Service Unavailable', { status: 503, statusText: 'Service Unavailable' });
  }
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