/* ================================================================
   sw.js — IPTV Live
   Estratégia:
   - App shell (html/css/js/manifest/icons): cache-first, com fallback
     de rede e atualização em segundo plano (stale-while-revalidate).
   - Chamadas à API de canais/streams (iptv-org): network-first, cai
     para cache quando offline.
   - Streams de vídeo (.m3u8 / .ts) e o próprio CDN do hls.js: NUNCA
     entram no cache — são sempre buscados direto da rede.
   ================================================================ */

const CACHE_VERSION = 'iptv-live-v4';
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const API_CACHE = `${CACHE_VERSION}-api`;

const SHELL_FILES = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './config.js',
  './sw.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

const API_HOSTS = ['iptv-org.github.io'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(cache => cache.addAll(SHELL_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key.startsWith('iptv-live-') && key !== SHELL_CACHE && key !== API_CACHE)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('push', (event) => {
  let data = { title: 'IPTV Live', body: 'Há novidades nos seus canais.' };
  try { if (event.data) data = { ...data, ...event.data.json() }; } catch { /* payload não JSON: usa fallback */ }
  event.waitUntil(self.registration.showNotification(data.title, {
    body: data.body,
    icon: './icon-192.png',
    badge: './icon-192.png',
    tag: data.tag || 'iptv-live-update',
    data: { url: data.url || './' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const target = event.notification.data && event.notification.data.url || './';
    const existing = list.find(client => 'focus' in client);
    return existing ? existing.focus() : clients.openWindow(target);
  }));
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Nunca interceptar streams de vídeo (m3u8/ts) nem o CDN do hls.js
  if (isVideoStream(url)) return;

  if (API_HOSTS.includes(url.hostname)) {
    event.respondWith(networkFirst(req, API_CACHE));
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(req, SHELL_CACHE));
  }
});

function isVideoStream(url) {
  return (
    url.pathname.endsWith('.m3u8') ||
    url.pathname.endsWith('.ts') ||
    url.hostname.includes('cdnjs.cloudflare.com')
  );
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const fresh = await fetch(request);
    cache.put(request, fresh.clone());
    return fresh;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw err;
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const networkFetch = fetch(request)
    .then(response => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);

  return cached || networkFetch;
}
