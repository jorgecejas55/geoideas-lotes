// Service worker: app y capas disponibles sin conexión; imágenes satelitales en caché a medida que se ven.
const VERSION = '__VERSION__';
const APP = 'app-' + VERSION;
const TILES = 'tiles-v1';
const MAX_TILES = 4000;
const PRECACHE = __PRECACHE__;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(APP).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('app-') && k !== APP).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

async function trimTiles() {
  const c = await caches.open(TILES);
  const keys = await c.keys();
  for (let i = 0; i < keys.length - MAX_TILES; i++) await c.delete(keys[i]);
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Teselas del mapa base: primero caché, luego red (y se guardan).
  if (url.hostname.endsWith('arcgisonline.com')) {
    e.respondWith(caches.open(TILES).then(async (c) => {
      const hit = await c.match(req);
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res.ok || res.type === 'opaque') { c.put(req, res.clone()); trimTiles(); }
        return res;
      } catch { return new Response('', { status: 504 }); }
    }));
    return;
  }

  if (url.origin !== location.origin) return;

  // Datos de lotes: red primero (para tomar actualizaciones), caché si no hay señal.
  if (url.pathname.startsWith('/data/')) {
    e.respondWith(fetch(req).then((res) => { const cp = res.clone(); caches.open(APP).then((c) => c.put(req, cp)); return res; })
      .catch(() => caches.match(req)));
    return;
  }

  // Resto de la app: caché primero.
  e.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).catch(() => (req.mode === 'navigate' ? caches.match('/') : undefined))));
});
