// VidHarvest Pro - Service Worker

const CACHE_NAME = 'vidharvest-pro-v1.0.0';
const STATIC_CACHE = 'vidharvest-static-v1.0.0';
const DYNAMIC_CACHE = 'vidharvest-dynamic-v1.0.0';

// Files to cache immediately
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/css/styles.css',
    '/js/app.js',
    '/manifest.json'
];

// API endpoints that should work offline
const OFFLINE_FALLBACKS = {
    '/api/analyze': '/offline/analyze.json',
    '/api/download': '/offline/download.json'
};

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('Service Worker installing...');
    
    event.waitUntil(
        Promise.all([
            caches.open(STATIC_CACHE).then((cache) => {
                console.log('Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            }),
            self.skipWaiting()
        ])
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('Service Worker activating...');
    
    event.waitUntil(
        Promise.all([
            // Clean up old caches
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== STATIC_CACHE && 
                            cacheName !== DYNAMIC_CACHE && 
                            cacheName !== CACHE_NAME) {
                            console.log('Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            }),
            self.clients.claim()
        ])
    );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Handle different types of requests
    if (request.method === 'GET') {
        if (url.pathname.startsWith('/api/')) {
            // API requests
            event.respondWith(handleApiRequest(request));
        } else if (STATIC_ASSETS.includes(url.pathname)) {
            // Static assets
            event.respondWith(handleStaticRequest(request));
        } else {
            // Dynamic content
            event.respondWith(handleDynamicRequest(request));
        }
    }
});

// Handle static asset requests
async function handleStaticRequest(request) {
    try {
        const cache = await caches.open(STATIC_CACHE);
        const cachedResponse = await cache.match(request);
        
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // If not in cache, fetch and cache
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        console.error('Static request failed:', error);
        
        // Return offline fallback for HTML requests
        if (request.headers.get('accept').includes('text/html')) {
            return caches.match('/index.html');
        }
        
        throw error;
    }
}

// Handle dynamic content requests
async function handleDynamicRequest(request) {
    try {
        // Try network first
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            // Cache successful responses
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        console.log('Network request failed, trying cache:', request.url);
        
        // Fallback to cache
        const cache = await caches.open(DYNAMIC_CACHE);
        const cachedResponse = await cache.match(request);
        
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // Final fallback for HTML requests
        if (request.headers.get('accept').includes('text/html')) {
            return caches.match('/index.html');
        }
        
        throw error;
    }
}

// Handle API requests with offline support
async function handleApiRequest(request) {
    const url = new URL(request.url);
    
    try {
        // Try network first
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            // Cache successful API responses for offline use
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        console.log('API request failed, checking offline options:', url.pathname);
        
        // Check for cached response
        const cache = await caches.open(DYNAMIC_CACHE);
        const cachedResponse = await cache.match(request);
        
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // Return offline fallback if available
        if (OFFLINE_FALLBACKS[url.pathname]) {
            return handleOfflineFallback(url.pathname, request);
        }
        
        // Return offline error response
        return new Response(
            JSON.stringify({
                success: false,
                error: 'This feature requires an internet connection',
                offline: true
            }),
            {
                status: 503,
                headers: { 'Content-Type': 'application/json' }
            }
        );
    }
}

// Handle offline fallbacks
async function handleOfflineFallback(pathname, request) {
    switch (pathname) {
        case '/api/analyze':
            return new Response(
                JSON.stringify({
                    success: false,
                    error: 'Video analysis requires an internet connection. Please check your connection and try again.',
                    offline: true
                }),
                {
                    status: 503,
                    headers: { 'Content-Type': 'application/json' }
                }
            );
            
        case '/api/download':
            return new Response(
                JSON.stringify({
                    success: false,
                    error: 'Downloads require an internet connection. Your request will be processed when you\'re back online.',
                    offline: true
                }),
                {
                    status: 503,
                    headers: { 'Content-Type': 'application/json' }
                }
            );
            
        default:
            return new Response(
                JSON.stringify({
                    success: false,
                    error: 'This feature is not available offline',
                    offline: true
                }),
                {
                    status: 503,
                    headers: { 'Content-Type': 'application/json' }
                }
            );
    }
}

// Background sync for offline actions
self.addEventListener('sync', (event) => {
    console.log('Background sync triggered:', event.tag);
    
    if (event.tag === 'offline-downloads') {
        event.waitUntil(syncOfflineDownloads());
    } else if (event.tag === 'offline-data') {
        event.waitUntil(syncOfflineData());
    }
});

// Sync offline downloads when connection is restored
async function syncOfflineDownloads() {
    try {
        const clients = await self.clients.matchAll();
        
        clients.forEach(client => {
            client.postMessage({
                type: 'SYNC_OFFLINE_DOWNLOADS'
            });
        });
        
        console.log('Offline downloads sync initiated');
    } catch (error) {
        console.error('Failed to sync offline downloads:', error);
    }
}

// Sync other offline data
async function syncOfflineData() {
    try {
        const clients = await self.clients.matchAll();
        
        clients.forEach(client => {
            client.postMessage({
                type: 'SYNC_OFFLINE_DATA'
            });
        });
        
        console.log('Offline data sync initiated');
    } catch (error) {
        console.error('Failed to sync offline data:', error);
    }
}

// Push notification handling
self.addEventListener('push', (event) => {
    console.log('Push notification received');
    
    let data = {};
    if (event.data) {
        try {
            data = event.data.json();
        } catch (error) {
            data = { title: 'VidHarvest Pro', body: event.data.text() };
        }
    }
    
    const options = {
        body: data.body || 'Your download is ready!',
        icon: '/images/icon-192x192.png',
        badge: '/images/badge-72x72.png',
        tag: data.tag || 'vidharvest-notification',
        data: data.data || {},
        actions: [
            {
                action: 'open',
                title: 'Open App',
                icon: '/images/icon-192x192.png'
            },
            {
                action: 'dismiss',
                title: 'Dismiss',
                icon: '/images/icon-192x192.png'
            }
        ],
        requireInteraction: data.requireInteraction || false
    };
    
    event.waitUntil(
        self.registration.showNotification(data.title || 'VidHarvest Pro', options)
    );
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
    console.log('Notification clicked:', event.action);
    
    event.notification.close();
    
    if (event.action === 'open' || !event.action) {
        // Open the app
        event.waitUntil(
            clients.matchAll({ type: 'window' }).then((clientList) => {
                // Check if app is already open
                for (const client of clientList) {
                    if (client.url.includes(self.location.origin) && 'focus' in client) {
                        return client.focus();
                    }
                }
                
                // Open new window if app is not open
                if (clients.openWindow) {
                    return clients.openWindow('/');
                }
            })
        );
    } else if (event.action === 'dismiss') {
        // Just close the notification (already done above)
        console.log('Notification dismissed');
    }
});

// Periodic background sync
self.addEventListener('periodicsync', (event) => {
    console.log('Periodic sync triggered:', event.tag);
    
    if (event.tag === 'check-updates') {
        event.waitUntil(checkForUpdates());
    }
});

// Check for app updates
async function checkForUpdates() {
    try {
        const response = await fetch('/api/version');
        const data = await response.json();
        
        // Compare versions and notify if update available
        const currentVersion = '1.0.0'; // This would be dynamic in a real app
        
        if (data.version !== currentVersion) {
            const clients = await self.clients.matchAll();
            
            clients.forEach(client => {
                client.postMessage({
                    type: 'UPDATE_AVAILABLE',
                    version: data.version
                });
            });
        }
    } catch (error) {
        console.error('Failed to check for updates:', error);
    }
}

// Handle messages from the main app
self.addEventListener('message', (event) => {
    console.log('Service Worker received message:', event.data);
    
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    } else if (event.data && event.data.type === 'GET_VERSION') {
        event.ports[0].postMessage({ version: '1.0.0' });
    } else if (event.data && event.data.type === 'CLEAR_CACHE') {
        event.waitUntil(clearAllCaches());
    }
});

// Clear all caches
async function clearAllCaches() {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map(name => caches.delete(name)));
    console.log('All caches cleared');
}

// Handle share target (when app is shared to)
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    
    if (url.pathname === '/share-target' && event.request.method === 'POST') {
        event.respondWith(handleShareTarget(event.request));
    }
});

// Handle shared content
async function handleShareTarget(request) {
    try {
        const formData = await request.formData();
        const sharedData = {
            title: formData.get('title') || '',
            text: formData.get('text') || '',
            url: formData.get('url') || ''
        };
        
        // Send shared data to the main app
        const clients = await self.clients.matchAll();
        
        if (clients.length > 0) {
            clients[0].postMessage({
                type: 'SHARE_TARGET',
                data: sharedData
            });
            
            // Focus the existing window
            clients[0].focus();
            
            return Response.redirect('/', 303);
        } else {
            // Open new window with shared data
            const url = new URL('/', self.location.origin);
            url.searchParams.set('shared', JSON.stringify(sharedData));
            
            return Response.redirect(url.toString(), 303);
        }
    } catch (error) {
        console.error('Failed to handle share target:', error);
        return Response.redirect('/', 303);
    }
}

// Cache management utilities
async function cleanupOldCaches() {
    const cacheNames = await caches.keys();
    const currentCaches = [STATIC_CACHE, DYNAMIC_CACHE, CACHE_NAME];
    
    const oldCaches = cacheNames.filter(name => !currentCaches.includes(name));
    
    await Promise.all(oldCaches.map(name => {
        console.log('Deleting old cache:', name);
        return caches.delete(name);
    }));
}

// Limit cache size
async function limitCacheSize(cacheName, maxItems) {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    
    if (keys.length > maxItems) {
        const keysToDelete = keys.slice(0, keys.length - maxItems);
        await Promise.all(keysToDelete.map(key => cache.delete(key)));
        console.log(`Cleaned up ${keysToDelete.length} items from ${cacheName}`);
    }
}

// Periodic cache cleanup
setInterval(() => {
    limitCacheSize(DYNAMIC_CACHE, 50);
}, 60000); // Every minute

console.log('VidHarvest Pro Service Worker loaded');