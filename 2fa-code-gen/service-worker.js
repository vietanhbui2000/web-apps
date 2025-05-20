const CACHE_NAME = '2fa-code-gen-v1';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './app.js',
    './styles.css',
    './manifest.json',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.2.0/crypto-js.min.js'
];

// Install event - cache assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(ASSETS_TO_CACHE))
            .then(() => self.skipWaiting())
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== CACHE_NAME) {
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => self.clients.claim())
    );
});

// Fetch event - serve from cache, fall back to network
self.addEventListener('fetch', (event) => {
    // Skip cross-origin requests to improve performance
    if (!event.request.url.startsWith(self.location.origin) && 
        !event.request.url.includes('cdnjs.cloudflare.com')) {
        return;
    }
    
    // For HTML requests - use network-first strategy
    if (event.request.headers.get('Accept') && 
        event.request.headers.get('Accept').includes('text/html')) {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    if (!response || response.status !== 200) {
                        return caches.match(event.request);
                    }
                    
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME)
                        .then((cache) => {
                            cache.put(event.request, responseClone);
                        });
                    
                    return response;
                })
                .catch(() => {
                    return caches.match(event.request);
                })
        );
        return;
    }
    
    // For all other requests - use cache-first strategy
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                if (response) {
                    return response;
                }
                
                return fetch(event.request)
                    .then((response) => {
                        // Don't cache non-GET requests
                        if (event.request.method !== 'GET') {
                            return response;
                        }
                        
                        // Don't cache error responses
                        if (!response || response.status !== 200) {
                            return response;
                        }
                        
                        // Clone the response as it can only be consumed once
                        const responseToCache = response.clone();
                        
                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                cache.put(event.request, responseToCache)
                                    .catch(err => {
                                        console.error('Cache put error:', err);
                                    });
                            });
                            
                        return response;
                    })
                    .catch(error => {
                        console.error('Fetch error:', error);
                        
                        // For JavaScript and CSS files, return a fallback
                        if (event.request.url.match(/\.(js|css)$/)) {
                            return caches.match(event.request);
                        }
                        
                        // Return a custom offline response
                        return new Response('Network error. Please check your connection.', {
                            status: 503,
                            statusText: 'Service Unavailable',
                            headers: new Headers({
                                'Content-Type': 'text/plain'
                            })
                        });
                    });
            })
    );
}); 