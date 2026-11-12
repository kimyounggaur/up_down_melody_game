/* The build script replaces these values with the complete static export list. */
const CACHE_NAME = 'updown-melody-__BUILD_VERSION__';
const PRECACHE = []; // __PRECACHE_FILES__
const ROUTES = {}; // __OFFLINE_ROUTES__

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE)));
  // Waiting is deliberate: a new version must not interrupt an active game.
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith('updown-melody-') && name !== CACHE_NAME).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

function routeKey(pathname) {
  const decoded = decodeURIComponent(pathname);
  if (decoded.endsWith('/index.html')) return decoded.slice(0, -10);
  if (decoded.endsWith('.html')) return decoded.slice(0, -5) + '/';
  return decoded.endsWith('/') ? decoded : decoded + '/';
}

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const isRsc = request.headers.get('RSC') === '1' || url.searchParams.has('_rsc');
    if (isRsc) {
      try {
        return await fetch(request);
      } catch {
        const exact = await cache.match(url.pathname, { ignoreSearch: true });
        const path = ROUTES[routeKey(url.pathname)]?.rsc;
        const fallback = path ? await cache.match(path) : null;
        const response = fallback || (url.pathname.endsWith('.txt') ? exact : null);
        if (response) return new Response(response.body, { status: 200, headers: { 'Content-Type': 'text/x-component; charset=utf-8' } });
        return Response.error();
      }
    }
    if (request.mode === 'navigate') {
      try {
        return await fetch(request);
      } catch {
        const route = ROUTES[routeKey(url.pathname)];
        return (route ? await cache.match(route.html) : null) || await cache.match('/index.html') || Response.error();
      }
    }
    const cached = await cache.match(url.pathname, { ignoreSearch: true });
    if (cached) return cached;
    return fetch(request);
  })());
});
