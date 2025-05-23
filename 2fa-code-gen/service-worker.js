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
            .catch((error) => {
                console.error('Failed to cache assets during install:', error);
            })
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
            .catch((error) => {
                console.error('Failed to clean up caches during activate:', error);
            })
    );
});

// Optimized fetch event handler
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const requestUrl = new URL(request.url);
    
    // Skip non-GET requests and cross-origin requests except allowed CDNs
    if (request.method !== 'GET') return;
    
    const isSameOrigin = requestUrl.origin === self.location.origin;
    const isAllowedCDN = requestUrl.hostname === 'cdnjs.cloudflare.com';
    
    if (!isSameOrigin && !isAllowedCDN) return;
    
    // Use different strategies based on request type
    if (request.headers.get('Accept')?.includes('text/html')) {
        // Network-first strategy for HTML requests
        event.respondWith(handleHTMLRequest(request));
    } else {
        // Cache-first strategy for other resources
        event.respondWith(handleResourceRequest(request));
    }
});

// Handle HTML requests with network-first strategy
async function handleHTMLRequest(request) {
    try {
        const response = await fetch(request);
        if (response && response.ok) {
            // Cache successful responses
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, response.clone()).catch(console.error);
            return response;
        }
        throw new Error('Network response not ok');
    } catch (error) {
        // Fallback to cache
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // Return offline page or error response
        return new Response('Offline - Please check your connection', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'text/plain' }
        });
    }
}

// Handle resource requests with cache-first strategy
async function handleResourceRequest(request) {
    try {
        // Try cache first
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // If not in cache, fetch from network
        const response = await fetch(request);
        if (response && response.ok) {
            // Cache successful responses
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, response.clone()).catch(console.error);
            return response;
        }
        
        throw new Error('Network response not ok');
    } catch (error) {
        console.error('Resource fetch failed:', error);
        
        // Return a minimal error response for failed resources
        return new Response('', {
            status: 408,
            statusText: 'Request Timeout',
            headers: { 'Content-Type': 'text/plain' }
        });
    }
} 