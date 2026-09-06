const CACHE_NAME = 'spotify-clone-shell-v1';
const AUDIO_CACHE = 'spotify-audio-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Bypass Service Worker entirely for all audio streams and range requests
  // This allows native WebKit / Android OS background audio streaming without Service Worker lifecycle interruptions
  if (
    event.request.destination === 'audio' ||
    event.request.headers.get('range') ||
    url.pathname.startsWith('/api/stream') ||
    url.pathname.includes('/stream/') ||
    url.hostname.includes('apple.com') ||
    url.hostname.includes('googlevideo.com') ||
    url.hostname.includes('audius')
  ) {
    return;
  }

  // Basic network-first strategy for other assets
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (event.request.method === 'GET' && (url.protocol === 'http:' || url.protocol === 'https:')) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
        }
        return networkResponse;
      })
      .catch(() => caches.match(event.request))
  );
});
