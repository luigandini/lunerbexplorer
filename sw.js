// Funciona sem internet depois da primeira vez. Sempre tenta a versão nova primeiro.
const CACHE = 'lunerb-v6-002';
const FILES = [
  './', 'index.html', 'style.css', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png',
  'vendor/three.module.min.js',
  'src/main.js', 'src/game.js', 'src/world.js', 'src/models.js', 'src/fx.js', 'src/geo.js', 'src/textures.js', 'src/props.js', 'src/inventory.js',
  'src/input.js', 'src/ui.js', 'src/audio.js', 'src/levels.js', 'src/progress.js', 'src/save.js', 'src/mundo3.js',
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  // sempre pergunta ao servidor se há versão nova (para as atualizações aparecerem logo)
  const same = new URL(e.request.url).origin === self.location.origin;
  const req = same ? fetch(e.request.url, { cache: 'no-cache' }) : fetch(e.request);
  e.respondWith(
    req.then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
