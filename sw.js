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
const CACHE_NAME = 'jemaos-gallery-v1.3.2';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './scripts/loader.js',
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
  './scripts/pdf-viewer.js',
  './scripts/pdf-text-editor.js',
  './scripts/audio-player.js',
  './scripts/video-player.js',
  './scripts/annotation-manager.js',
  './icons/icon.svg',
  './icons/icon-192x192.svg',
  './icons/icon-512x512.svg',
  'https://fonts.googleapis.com/css2?family=Roboto:ital,wght@0,300;0,400;0,500;0,700;1,400&display=swap',
  'https://fonts.googleapis.com/icon?family=Material+Icons',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
  'https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js'
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
        // return self.skipWaiting(); // Wait for user to confirm update
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
      return self.clients.claim();
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

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return cached version or fetch from network
        if (response) {
          return response;
        }

        return fetch(event.request).then(response => {
          // Don't cache non-successful responses
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // Clone the response for caching
          const responseToCache = response.clone();

          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            });

          return response;
        }).catch(error => {
          console.error('[SW] Fetch failed:', error);
          
          // Return offline fallback for navigation requests
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
          
          throw error;
        });
      })
  );
});

// Handle file share target
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({version: CACHE_NAME});
  }
  
  if (event.data && event.data.type === 'SHARE_FILES') {
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
  return new Promise((resolve) => {
    console.log('[SW] Background sync completed');
    resolve();
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
    self.registration.showNotification('Galerie', options)
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
if (self.registration && 'periodicSync' in self.registration) {
  self.addEventListener('periodicsync', event => {
    if (event.tag === 'gallery-sync') {
      event.waitUntil(syncGalleryData());
    }
  });
}

function syncGalleryData() {
  return new Promise((resolve) => {
    console.log('[SW] Periodic sync completed');
    resolve();
  });
}

// File system access (for supported browsers)
self.addEventListener('fileSystemAccess', event => {
  if (event.data) {
    console.log('[SW] File system access granted');
  }
});