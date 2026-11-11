#!/usr/bin/env python3
"""Baut aus quelle/eriks-rezepte.html die iPhone-Fassung in docs/ (für GitHub Pages).

Aufruf:  python3 build.py
Ergebnis: docs/index.html, styles.css, app.js, sw.js, manifest.webmanifest, icons/
Für die Icons wird Playwright (Chromium) genutzt, falls vorhanden. Sonst bleiben vorhandene Icons erhalten.
"""
import hashlib, json, os, re, shutil, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, 'quelle', 'eriks-rezepte.html')
OUT = os.path.join(ROOT, 'docs')

html = open(SRC, encoding='utf-8').read()
css = re.search(r'<style>\n?(.*?)</style>', html, re.S).group(1)
js = re.search(r'<script>\n?(.*?)</script>', html, re.S).group(1)
body = re.search(r'<body>(.*?)<script>', html, re.S).group(1).strip()
assert 'googleapis' not in html and 'gstatic' not in html, 'Externe Schriften gefunden'

# Service Worker anmelden und Update-Hinweis zeigen (nur über https/localhost)
js += r'''
/* ---------- Offline-Fähigkeit und Updates ---------- */
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloading) { reloading = true; location.reload(); } });
  const offer = (w) => {
    if (!w || document.querySelector('.update-bar')) return;
    const bar = h('div', { class: 'update-bar', role: 'status' }, h('span', null, 'Neue Version verfügbar'),
      h('button', { onclick: () => w.postMessage('skip-waiting') }, 'Aktualisieren'));
    document.body.append(bar);
  };
  navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then(reg => {
    if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w && w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w); });
    });
    const check = () => reg.update().catch(() => {});
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
    window.addEventListener('pageshow', check); window.addEventListener('focus', check);
    setInterval(check, 30 * 60 * 1000);
  }).catch(() => {});
}
'''

if os.path.isdir(OUT):
    for f in os.listdir(OUT):
        if f != 'icons':
            p = os.path.join(OUT, f)
            shutil.rmtree(p) if os.path.isdir(p) else os.remove(p)
os.makedirs(os.path.join(OUT, 'icons'), exist_ok=True)

ver = hashlib.sha256((css + js + body).encode()).hexdigest()[:10]
js = f"window.APP_VERSION = '{ver}';\n" + js
open(os.path.join(OUT, 'styles.css'), 'w', encoding='utf-8').write(css)
open(os.path.join(OUT, 'app.js'), 'w', encoding='utf-8').write(js)

CSP = ("default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; "
       "connect-src 'self'; font-src 'self'; manifest-src 'self'; worker-src 'self'; object-src 'none'; "
       "base-uri 'none'; form-action 'none'")
index = f'''<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="{CSP}">
<meta name="referrer" content="no-referrer">
<meta name="robots" content="noindex, nofollow">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Rezepte">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="theme-color" content="#ECEAE5" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#1C1A17" media="(prefers-color-scheme: dark)">
<meta name="format-detection" content="telephone=no">
<title>Eriks Rezepte</title>
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icons/icon-192.png" sizes="192x192">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<link rel="stylesheet" href="styles.css?v={ver}">
</head>
<body>
{body}
<script src="app.js?v={ver}"></script>
</body>
</html>
'''
open(os.path.join(OUT, 'index.html'), 'w', encoding='utf-8').write(index)

manifest = {
    'name': 'Eriks Rezepte', 'short_name': 'Rezepte', 'lang': 'de', 'dir': 'ltr',
    'description': 'Rezepte, Wochenplanung, Vorrat und Einkaufsliste. Alles bleibt auf dem Gerät.',
    'id': './', 'start_url': './', 'scope': './', 'display': 'standalone',
    'background_color': '#ECEAE5', 'theme_color': '#ECEAE5',
    'icons': [
        {'src': 'icons/icon-192.png', 'sizes': '192x192', 'type': 'image/png'},
        {'src': 'icons/icon-512.png', 'sizes': '512x512', 'type': 'image/png'},
        {'src': 'icons/icon-maskable-512.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'maskable'},
    ],
}
open(os.path.join(OUT, 'manifest.webmanifest'), 'w', encoding='utf-8').write(json.dumps(manifest, ensure_ascii=False, indent=2))

files = ['./', 'index.html', f'styles.css?v={ver}', f'app.js?v={ver}', 'manifest.webmanifest',
         'icons/apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png']
sw = f'''// Eriks Rezepte – Offline-Speicher für die App-Dateien. Deine Daten liegen NICHT hier, sondern in IndexedDB.
const CACHE = 'eriks-rezepte-{ver}';
const FILES = {json.dumps(files)};
self.addEventListener('install', (e) => {{ e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))); }});
self.addEventListener('message', (e) => {{ if (e.data === 'skip-waiting') self.skipWaiting(); }});
self.addEventListener('activate', (e) => {{
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('eriks-rezepte-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
}});
self.addEventListener('fetch', (e) => {{
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.mode === 'navigate') {{
    // Seite: erst Netz (damit Updates ankommen), offline aus dem Speicher
    e.respondWith(fetch(req.url, {{ cache: 'no-store', credentials: 'same-origin' }}).catch(() => caches.match('index.html', {{ ignoreSearch: true }})));
    return;
  }}
  e.respondWith(caches.match(req).then(hit => hit || fetch(req)));
}});
'''
open(os.path.join(OUT, 'sw.js'), 'w', encoding='utf-8').write(sw)
open(os.path.join(OUT, '.nojekyll'), 'w').write('')

# ---------- Icons ----------
ICON = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="{s}" height="{s}">
<rect width="512" height="512" fill="#46613F"/>
<g transform="translate(256 262) scale({k}) translate(-256 -262)">
  <path d="M300 118c56-6 94 20 104 52-40 22-92 22-124-6 2-20 8-36 20-46z" fill="#A9C48F"/>
  <path d="M298 170c-14 18-26 40-32 66" stroke="#A9C48F" stroke-width="10" fill="none" stroke-linecap="round"/>
  <path d="M106 246h300c0 92-66 160-150 160S106 338 106 246z" fill="#FAF9F6"/>
  <rect x="96" y="232" width="320" height="26" rx="13" fill="#B08D62"/>
  <path d="M190 414h132" stroke="#B08D62" stroke-width="18" stroke-linecap="round"/>
</g></svg>'''
def make_icons():
    try:
        from playwright.sync_api import sync_playwright
    except Exception:
        print('Hinweis: Playwright fehlt, Icons werden nicht neu erzeugt.'); return
    exe = '/usr/bin/google-chrome' if os.path.exists('/usr/bin/google-chrome') else None
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=exe) if exe else p.chromium.launch()
        for name, size, k in [('apple-touch-icon.png', 180, 1), ('icon-192.png', 192, 1), ('icon-512.png', 512, 1), ('icon-maskable-512.png', 512, .78)]:
            pg = b.new_page(viewport={'width': size, 'height': size})
            pg.set_content('<style>html,body{margin:0}</style>' + ICON.format(s=size, k=k))
            pg.screenshot(path=os.path.join(OUT, 'icons', name), omit_background=False)
            pg.close()
        b.close()
if '--no-icons' not in sys.argv:
    make_icons()
print(f'Fertig: docs/ (Version {ver})')
