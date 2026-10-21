const CACHE_NAME = 'app-cache-v1';

const STRATEGY = 'cache-first';

const BASE = self.registration.scope;

const PRECACHE = [BASE];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

function shouldHandle(request) {
  if (request.method !== 'GET') return false;
  if (!request.url.startsWith(BASE)) return false;
  if (request.headers.has('range')) return false;
  return true;
}

async function fetchAndCache(request) {
  const response = await fetch(request);
  if (response && response.ok && response.status === 200) {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  }
  return response;
}

async function offlineFallback(request) {
  if (request.mode === 'navigate') {
    const cache = await caches.open(CACHE_NAME);
    return (
      (await cache.match(request, { ignoreSearch: true })) ||
      (await cache.match(BASE)) ||
      Response.error()
    );
  }
  return Response.error();
}

async function cacheFirst(event) {
  const { request } = event;
  const cached = await caches.match(request);
  if (cached) {
    event.waitUntil(fetchAndCache(request).catch(() => {}));
    return cached;
  }
  try {
    return await fetchAndCache(request);
  } catch {
    return offlineFallback(request);
  }
}

async function networkFirst(request) {
  try {
    return await fetchAndCache(request);
  } catch {
    const cached = await caches.match(request);
    return cached || offlineFallback(request);
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (!shouldHandle(request)) return;
  event.respondWith(STRATEGY === 'network-first' ? networkFirst(request) : cacheFirst(event));
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches
        .keys()
        .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
        .then(() => event.ports[0] && event.ports[0].postMessage({ ok: true }))
    );
  }
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
