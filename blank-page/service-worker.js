const CACHE_NAME = 'blank-page-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css'
];

// Install event - cache all static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => self.skipWaiting())
      .catch(error => {
        console.error('Service worker cache install failed:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(cacheName => {
          return cacheName !== CACHE_NAME;
        }).map(cacheName => {
          return caches.delete(cacheName);
        })
      );
    }).then(() => self.clients.claim())
    .catch(error => {
      console.error('Service worker activation failed:', error);
    })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {
  // Skip cross-origin requests except for Font Awesome
  const requestUrl = new URL(event.request.url);
  const isSameOrigin = requestUrl.origin === self.location.origin;
  const isFontAwesome = event.request.url.includes('cdnjs.cloudflare.com');
  
  if (isSameOrigin || isFontAwesome) {
    event.respondWith(
      caches.match(event.request)
        .then(cachedResponse => {
          if (cachedResponse) {
            return cachedResponse;
          }
          
          return fetch(event.request)
            .then(response => {
              // Don't cache error responses
              if (!response || response.status !== 200 || response.type !== 'basic') {
                return response;
              }
              
              // Cache a copy of the response
              const responseToCache = response.clone();
              
              caches.open(CACHE_NAME)
                .then(cache => {
                  cache.put(event.request, responseToCache);
                })
                .catch(error => {
                  console.error('Error caching response:', error);
                });
              
              return response;
            })
            .catch(error => {
              console.error('Fetch error:', error);
              
              // If both cache and network fail for HTML requests,
              // return the offline page
              if (event.request.headers.get('accept')?.includes('text/html')) {
                return caches.match('./index.html');
              }
              
              // Return empty response for other failures
              return new Response('', {
                status: 408,
                headers: { 'Content-Type': 'text/plain' }
              });
            });
        })
    );
  }
}); 