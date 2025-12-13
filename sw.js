// sw.js - Service Worker pour PWA
const CACHE_NAME = 'mathx-v2.0';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/exercices.html',
  '/profil.html',
  '/auth.html',
  '/style.css',
  '/exercices.css',
  '/script.js',
  '/exercices.js',
  '/logo.png',
  '/icon-192x192.png',
  '/icon-512x512.png',
  '/manifest.json'
];

// Installation
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('📦 Cache ouvert');
        return cache.addAll(ASSETS_TO_CACHE);
      })
  );
});

// Activation
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Suppression ancien cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Fetch
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }
        return fetch(event.request)
          .then((response) => {
            // Mise en cache des nouvelles ressources
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });
            return response;
          });
      })
  );
});

// Push notifications (optionnel)
self.addEventListener('push', (event) => {
  const options = {
    body: event.data?.text() || 'Nouvelle notification MATH-X-HELPER',
    icon: '/icon-192x192.png',
    badge: '/icon-96x96.png',
    vibrate: [200, 100, 200],
    data: {
      url: '/'
    }
  };
  
  event.waitUntil(
    self.registration.showNotification('MATH-X-HELPER', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url || '/')
  );
});