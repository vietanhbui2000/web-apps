const CACHE_NAME = 'blank-page-v2';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'
];

// Utility function for consistent error handling
const logError = (message, error) => {
  console.error(`[Service Worker] ${message}`, error);
};

// Install event - cache all static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS_TO_CACHE))
      .then(() => self.skipWaiting())
      .catch(error => logError('Cache install failed', error))
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(cacheNames => 
        Promise.all(
          cacheNames
            .filter(cacheName => cacheName !== CACHE_NAME)
            .map(cacheName => caches.delete(cacheName))
        )
      )
      .then(() => self.clients.claim())
      .catch(error => logError('Activation failed', error))
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {
  // Skip cross-origin requests except for allowed CDN resources
  const requestUrl = new URL(event.request.url);
  const isSameOrigin = requestUrl.origin === self.location.origin;
  const isAllowedCDN = event.request.url.includes('cdnjs.cloudflare.com');
  
  if (!isSameOrigin && !isAllowedCDN) {
    return; // Let browser handle non-cacheable requests
  }
  
  // Handle cacheable requests
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }
        
        // Not in cache, get from network
        return fetch(event.request)
          .then(response => {
            // Don't cache error responses or non-basic responses (except allowed CDNs)
            if (!response || response.status !== 200 || (response.type !== 'basic' && !isAllowedCDN)) {
              return response;
            }
            
            // Cache a copy of the response asynchronously
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => cache.put(event.request, responseToCache))
              .catch(error => logError('Error caching response', error));
            
            return response;
          })
          .catch(error => {
            logError('Fetch error', error);
            
            // If both cache and network fail for HTML requests, return the offline page
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
}); 