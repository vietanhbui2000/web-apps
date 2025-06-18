const CACHE_NAME = '2fa-code-gen-v2';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './app.js',
    './styles.css',
    './manifest.json',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.2.0/crypto-js.min.js'
];

// Critical JavaScript libraries that should use network-first strategy
const CRITICAL_JS_LIBS = [
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
    } else if (CRITICAL_JS_LIBS.includes(request.url)) {
        // Network-first strategy for critical JavaScript libraries
        event.respondWith(handleCriticalJSRequest(request));
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

// Handle critical JavaScript requests with network-first strategy and cache validation
async function handleCriticalJSRequest(request) {
    try {
        // Try network first for critical JS libraries
        const response = await fetch(request);
        if (response && response.ok) {
            // Validate the response content for JavaScript files
            const responseClone = response.clone();
            const text = await responseClone.text();
            
            // Basic validation: check if it's actually JavaScript content
            if (text.length > 0 && !text.includes('<!DOCTYPE') && !text.includes('<html')) {
                // Cache the validated response
                const cache = await caches.open(CACHE_NAME);
                cache.put(request, response.clone()).catch(console.error);
                return response;
            } else {
                console.warn('Invalid JavaScript content received, trying cache fallback');
                throw new Error('Invalid JavaScript content');
            }
        }
        throw new Error('Network response not ok');
    } catch (error) {
        console.warn('Network failed for critical JS, trying cache:', error.message);
        
        // Fallback to cache, but validate it first
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            try {
                const cachedText = await cachedResponse.clone().text();
                
                // Validate cached content
                if (cachedText.length > 0 && !cachedText.includes('<!DOCTYPE') && !cachedText.includes('<html')) {
                    console.log('Using validated cached version of critical JS');
                    return cachedResponse;
                } else {
                    console.warn('Cached JS content appears invalid, removing from cache');
                    // Remove invalid cache entry
                    const cache = await caches.open(CACHE_NAME);
                    await cache.delete(request);
                }
            } catch (cacheError) {
                console.warn('Error validating cached JS:', cacheError);
                // Remove potentially corrupted cache entry
                const cache = await caches.open(CACHE_NAME);
                await cache.delete(request);
            }
        }
        
        // If we reach here, both network and cache failed or were invalid
        console.error('Critical JS library failed to load from both network and cache');
        return new Response('// Critical library failed to load', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'application/javascript' }
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