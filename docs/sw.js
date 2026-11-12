// Eriks Rezepte – Offline-Speicher für die App-Dateien. Deine Daten liegen NICHT hier, sondern in IndexedDB.
const CACHE = 'eriks-rezepte-0f1e017438';
const FILES = ["./", "index.html", "styles.css?v=0f1e017438", "app.js?v=0f1e017438", "manifest.webmanifest", "icons/apple-touch-icon.png", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png"];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))); });
self.addEventListener('message', (e) => { if (e.data === 'skip-waiting') self.skipWaiting(); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('eriks-rezepte-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.mode === 'navigate') {
    // Seite: erst Netz (damit Updates ankommen), offline aus dem Speicher
    e.respondWith(fetch(req.url, { cache: 'no-store', credentials: 'same-origin' }).catch(() => caches.match('index.html', { ignoreSearch: true })));
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req)));
});
