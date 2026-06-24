// Service Worker for offline functionality
const CACHE_NAME = 'apple-pudding-v1';
const RUNTIME_CACHE = 'runtime-cache';

// Static assets to cache on install
const STATIC_ASSETS = [
    '/',
    '/static/index.html',
    // Add more static assets as needed
];

// Common Q&A content to cache
const QA_CACHE_PATTERNS = [
    '/api/animal/chat',
    '/api/models'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('[SW] Installing service worker...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[SW] Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => self.skipWaiting())
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating service worker...');
    event.waitUntil(
        caches.keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames
                        .filter(name => name !== CACHE_NAME && name !== RUNTIME_CACHE)
                        .map(name => {
                            console.log('[SW] Deleting old cache:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => self.clients.claim())
    );
});

// Fetch event - network first, fall back to cache
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }

    // For API requests, use network-first strategy
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(networkFirst(request));
        return;
    }

    // For static assets, use cache-first strategy
    event.respondWith(cacheFirst(request));
});

// Network-first strategy for API calls
async function networkFirst(request) {
    try {
        const response = await fetch(request);

        // Clone response before caching
        const responseClone = response.clone();

        // Cache successful responses
        if (response.status === 200) {
            caches.open(RUNTIME_CACHE).then(cache => {
                cache.put(request, responseClone);
            });
        }

        return response;
    } catch (error) {
        console.log('[SW] Network failed, trying cache:', request.url);
        const cachedResponse = await caches.match(request);

        if (cachedResponse) {
            return cachedResponse;
        }

        // Return offline fallback
        return new Response(
            JSON.stringify({
                success: false,
                error: 'offline',
                message: '当前处于离线状态，请稍后重试'
            }),
            {
                headers: { 'Content-Type': 'application/json' },
                status: 503
            }
        );
    }
}

// Cache-first strategy for static assets
async function cacheFirst(request) {
    const cachedResponse = await caches.match(request);

    if (cachedResponse) {
        return cachedResponse;
    }

    try {
        const response = await fetch(request);
        const responseClone = response.clone();

        caches.open(CACHE_NAME).then(cache => {
            cache.put(request, responseClone);
        });

        return response;
    } catch (error) {
        console.log('[SW] Failed to fetch:', request.url);
        return new Response('Offline', { status: 503 });
    }
}

// Background sync for offline actions
self.addEventListener('sync', (event) => {
    console.log('[SW] Background sync triggered:', event.tag);

    if (event.tag === 'sync-activities') {
        event.waitUntil(syncActivities());
    }
});

// Sync queued activities when back online
async function syncActivities() {
    try {
        const cache = await caches.open('offline-queue');
        const requests = await cache.keys();

        for (const request of requests) {
            try {
                await fetch(request);
                await cache.delete(request);
                console.log('[SW] Synced activity:', request.url);
            } catch (error) {
                console.error('[SW] Failed to sync:', error);
            }
        }
    } catch (error) {
        console.error('[SW] Sync failed:', error);
    }
}

// Push notification support
self.addEventListener('push', (event) => {
    const data = event.data.json();

    const options = {
        body: data.body,
        icon: '/static/icon-192.png',
        badge: '/static/badge-72.png',
        data: data.url
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    if (event.notification.data) {
        event.waitUntil(
            clients.openWindow(event.notification.data)
        );
    }
});
