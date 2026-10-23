// Service worker de Neon Drift: permite jugar sin conexión (1 jugador).
// ⚠️ En cada publicación, sube el número de VERSION para que los móviles
//    descarguen la versión nueva y borren la caché antigua.
const VERSION = 'neon-drift-v9';
// Cada copia del juego (raíz, /prueba/, …) usa su propia caché, así una no borra la de la otra.
const SCOPE = new URL(self.registration.scope).pathname;
const CACHE = VERSION + ':' + SCOPE;
const CORE = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    // borra solo cachés antiguas de ESTA misma copia (las de nombre sin ':' son de versiones viejas en la raíz)
    .then(keys => Promise.all(keys.filter(k => k.startsWith('neon-drift-') && k !== CACHE && (k.endsWith(':' + SCOPE) || (!k.includes(':') && SCOPE === '/'))).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // PeerJS (CDN) y el servidor en línea van directos a la red

  // Páginas: primero la red (así siempre llega la última versión), y sin conexión la copia guardada.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(url.pathname.endsWith('/') ? './' : url.pathname, copy)); }
        return res;
      }).catch(() => caches.match(req, { ignoreSearch: true })
        .then(r => r || caches.match('./index.html')).then(r => r || caches.match('./')))
    );
    return;
  }

  // Resto (iconos, manifiesto): caché primero y se actualiza en segundo plano.
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => {
    const net = fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => hit);
    return hit || net;
  }));
});
