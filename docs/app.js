'use strict';
/* =========================================================
   Eriks Rezepte – lokale Rezept-App (eine Datei, offline)
   Speicherung: IndexedDB → Fallback localStorage → Fallback RAM
   ========================================================= */

const TAG_GROUPS = [
  { key: 'ziel', label: 'Zielrichtung', emoji: '🎯', tags: ['Abnehmgeeignet', 'Aufbaugeeignet'] },
  { key: 'art', label: 'Art', emoji: '🍽️', tags: ['Frühstück', 'Hauptmahlzeit', 'Snack', 'Dessert'] },
  { key: 'besonders', label: 'Besonderheit', emoji: '✨', all: true, tags: ['High Protein', 'High Fibre', 'Volumenreich', 'Hochkalorisch', 'Low Carb', 'Low Fat', 'Meal Prep', 'Schnell', 'Vegetarisch', 'Vegan'] },
  { key: 'geschmack', label: 'Geschmack', emoji: '👅', tags: ['Süß', 'Salzig', 'Deftig'] },
];
const TAG_EMOJI = { 'Abnehmgeeignet': '📉', 'Aufbaugeeignet': '💪', 'Frühstück': '🍳', 'Hauptmahlzeit': '🍝', 'Snack': '🥨', 'Dessert': '🍰', 'High Protein': '🥩', 'High Fibre': '🌾', 'Volumenreich': '🥬', 'Hochkalorisch': '🔥', 'Low Carb': '🥚', 'Low Fat': '🪶', 'Meal Prep': '📦', 'Schnell': '⚡', 'Vegetarisch': '🥕', 'Vegan': '🌱', 'Süß': '🍯', 'Salzig': '🧂', 'Deftig': '🥘' };
const PRESET_TAGS = TAG_GROUPS.flatMap(g => g.tags);
const groupOfTag = (t) => TAG_GROUPS.find(g => g.tags.includes(t)) || null;
const tagLabel = (t) => TAG_EMOJI[t] ? `${TAG_EMOJI[t]} ${t}` : t;
const VOL_LEVELS = [
  { n: 1, max: 60, emoji: '🟢', label: 'Sehr viel Volumen', bucket: 'viel' },
  { n: 2, max: 150, emoji: '🟢', label: 'Viel Volumen', bucket: 'viel' },
  { n: 3, max: 225, emoji: '🟡', label: 'Mittleres Volumen', bucket: 'mittel' },
  { n: 4, max: 400, emoji: '🟠', label: 'Wenig Volumen', bucket: 'wenig' },
  { n: 5, max: Infinity, emoji: '🔴', label: 'Sehr wenig Volumen', bucket: 'wenig' },
];
const VOL_BUCKETS = { viel: { emoji: '🟢', label: 'Viel Volumen' }, mittel: { emoji: '🟡', label: 'Mittleres Volumen' }, wenig: { emoji: '🔴', label: 'Wenig Volumen' } };
const volLevel = (dn) => VOL_LEVELS.find(l => dn <= l.max);
const WARN_LIMITS = { time: 45, density: 250, portion: 800 };
const WARN_OPTIONS = [
  { k: 'sucht', emoji: '🤤', label: 'Suchtgefahr', text: 'Suchtgefahr: schwer, bei einer Portion zu bleiben', level: 'bad' },
  { k: 'abwiegen', emoji: '🥄', label: 'Portion abwiegen', text: 'Portion abwiegen, sonst wird es schnell mehr', level: 'warn' },
  { k: 'abwasch', emoji: '🧽', label: 'Viel Abwasch', text: 'Viel Abwasch', level: 'info' },
  { k: 'zubehoer', emoji: '🔧', label: 'Spezielles Zubehör', text: 'Spezielles Zubehör nötig', level: 'info' },
  { k: 'allergene', emoji: '🥜', label: 'Allergene', text: 'Enthält häufige Allergene', level: 'info' },
];
const SPICE_LIB = ['Zimt', 'Nelken', 'Muskat', 'Vanille', 'Kardamom', 'Spekulatiusgewürz', 'Lebkuchengewürz', 'Ingwer', 'Sternanis', 'Kakao', 'Salz', 'Pfeffer', 'Paprika edelsüß', 'Paprika geräuchert', 'Chili', 'Kreuzkümmel', 'Kurkuma', 'Curry', 'Garam Masala', 'Knoblauchpulver', 'Zwiebelpulver', 'Oregano', 'Basilikum', 'Thymian', 'Rosmarin', 'Petersilie', 'Schnittlauch', 'Dill', 'Italienische Kräuter', 'Hähnchengewürz'];
const UNITS = ['g', 'ml', 'Stück', 'EL', 'TL', 'Prise', 'Scheibe', 'Portion', 'Packung', 'kg', 'l'];
const MACROS = [
  { k: 'carbs', label: 'Kohlenhydrate', short: 'KH', kcal: 4, color: 'var(--carbs)', emoji: '🍞' },
  { k: 'fat', label: 'Fett', short: 'Fett', kcal: 9, color: 'var(--fat)', emoji: '🥑' },
  { k: 'protein', label: 'Protein', short: 'Protein', kcal: 4, color: 'var(--protein)', emoji: '💪' },
];

/* ---------- Hilfsfunktionen ---------- */
const $ = (s, el = document) => el.querySelector(s);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'value') el.value = v;
    else if (k === 'checked') el.checked = !!v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}
const ICONS = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  back: '<path d="m15 18-6-6 6-6"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>',
  pdf: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  up: '<path d="m6 15 6-6 6 6"/>', down: '<path d="m6 9 6 6 6-6"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  people: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.5-3.5 3.2-5.5 6.5-5.5s6 2 6.5 5.5"/><circle cx="17" cy="9" r="2.5"/><path d="M17 14.5c2.5 0 4.2 1.6 4.5 4"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  import: '<path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
  book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5Z"/><path d="M4 19a2 2 0 0 1 2-2h13M9 7h6"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4M8 14h3v3H8z"/>',
  jar: '<path d="M8 3h8v3H8z"/><path d="M7 6h10a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z"/><path d="M5 11h14"/>',
  cart: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.6 12.2a2 2 0 0 0 2 1.6h8.2a2 2 0 0 0 2-1.5L21.5 8H6.2"/>',
  next: '<path d="m9 18 6-6-6-6"/>',
  share: '<path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/>',
  pot: '<path d="M5 11h14v6a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3v-6Z"/><path d="M3 11h18M9 7c0-1.5 1-2 1-3.5M14 7c0-1.5 1-2 1-3.5"/>',
  sunrise: '<path d="M4 18h16"/><path d="M7 18a5 5 0 0 1 10 0"/><path d="M12 6v3M5.6 10.6l1.8 1.4M18.4 10.6l-1.8 1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
  pin: '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11Z"/><circle cx="12" cy="10" r="2.5"/>',
  filter: '<path d="M4 5h16l-6 8v5l-4 2v-7L4 5Z"/>',
  more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  flake: '<path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7"/><path d="m9 4 3 2 3-2M9 20l3-2 3 2M4.2 10.5l3.2-.2-1.4-3M19.8 13.5l-3.2.2 1.4 3M4.2 13.5l3.2.2-1.4 3M19.8 10.5l-3.2-.2 1.4-3"/>',
};
const icon = (name) => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '2'); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round'); s.setAttribute('aria-hidden', 'true'); s.innerHTML = ICONS[name]; return s; };

function parseNum(v) {
  if (v == null) return 0;
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  let s = String(v).trim().replace(/\s/g, '').replace(/kcal|cal|mg|g/gi, '');
  if (!s || s === '-' || s === '--') return 0;
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.'); // 1.234,5
  else if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');               // 1,234.5
  else s = s.replace(',', '.');
  const n = parseFloat(s);
  return isFinite(n) ? n : 0;
}
const fmt = (n, d = 0) => { const v = Number(n) || 0; return v.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: d }); };
const fmtIn = (n) => (n === '' || n == null) ? '' : (Number(n) === 0 ? '0' : String(Math.round(Number(n) * 10) / 10).replace('.', ','));
const fmtAmt = (a, u) => { const n = parseNum(a); if (!a && a !== 0) return u || ''; if (!n) return u || ''; return `${fmt(n, 2)}${u ? (u.length <= 2 ? ' ' : ' ') + u : ''}`; };

const NATURE_TONES = [['#C9A87D', '#3E3226'], ['#DDE4D6', '#34502E'], ['#EFE6D8', '#5E4B37'], ['#D9C3A3', '#4D3F31'], ['#CBD5C4', '#34502E'], ['#E6DED2', '#5E4B37']];
const MONTHS = ['JAN', 'FEB', 'MÄR', 'APR', 'MAI', 'JUN', 'JUL', 'AUG', 'SEP', 'OKT', 'NOV', 'DEZ'];
/* Wandregal aus Eriks Wohnzimmer: Eichenbrett, Pflanzen, Klappuhr mit dem heutigen Datum */
function shelfSVG(kind = 'rezepte') {
  const now = new Date(); const dd = String(now.getDate()).padStart(2, '0'); const mm = MONTHS[now.getMonth()];
  const tile = (x, w, txt, fs, dy) => `<rect x="${x}" y="64" width="${w}" height="32" rx="4.5" fill="#262624"/><path d="M${x} 80 h${w}" stroke="#4A4946" stroke-width="1.3"/><text x="${x + w / 2}" y="${64 + dy}" text-anchor="middle" font-family="Inter, -apple-system, Arial, sans-serif" font-weight="700" font-size="${fs}" fill="#FAF9F6"${fs < 14 ? ' letter-spacing="1"' : ''}>${txt}</text>`;
  const clock = (x) => tile(x, 22, dd[0], 20, 23) + tile(x + 25, 22, dd[1], 20, 23) + tile(x + 50, 38, mm, 11, 20);
  const board = '<rect x="0" y="96" width="200" height="11" rx="1.5" fill="#B08D62"/><rect x="0" y="96" width="200" height="3" fill="#C9A87D"/><path d="M14 102 H80 M110 103 H186" stroke="#9A784F" stroke-width="1" opacity=".5"/><rect x="0" y="107" width="200" height="4" fill="#000" opacity=".07"/>';
  const plant = (x) => `<rect x="${x}" y="76" width="28" height="20" rx="4" fill="#FAF9F6" stroke="#D6D2CA"/><g fill="#46613F"><ellipse cx="${x + 6}" cy="66" rx="7.5" ry="9.5"/><ellipse cx="${x + 20}" cy="62" rx="8.5" ry="11.5"/><ellipse cx="${x + 13}" cy="54" rx="6.5" ry="8.5"/></g><g fill="#5C7A52"><ellipse cx="${x + 27}" cy="71" rx="5" ry="6.5"/><ellipse cx="${x}" cy="72" rx="4.5" ry="6"/></g>`;
  const ivy = '<path d="M10 96 C4 112 14 122 8 140" stroke="#5C7A52" stroke-width="1.4" fill="none"/><g fill="#46613F"><ellipse cx="12" cy="105" rx="6" ry="3.6"/><ellipse cx="6" cy="116" rx="5.5" ry="3.4"/><ellipse cx="13" cy="127" rx="5" ry="3.2"/><ellipse cx="8" cy="137" rx="4.5" ry="3"/></g>';
  const vase = (x) => `<path d="M${x} 96 C${x - 4} 82 ${x - 2} 76 ${x + 6} 73 C${x + 15} 76 ${x + 17} 82 ${x + 12} 96 Z" fill="#8A6A4C"/>`;
  const jar = (x, hh, fill) => `<rect x="${x - 2}" y="${96 - hh - 6}" width="30" height="7" rx="2.5" fill="#9A784F"/><rect x="${x}" y="${96 - hh}" width="26" height="${hh}" rx="5" fill="#F4F2EE" stroke="#D6D2CA"/><rect x="${x + 4}" y="${96 - hh * 0.62}" width="18" height="${hh * 0.62 - 4}" rx="3" fill="${fill}"/>`;
  let inner = '', label = '';
  if (kind === 'rezepte') { inner = ivy + clock(34) + vase(134) + plant(160); label = `Klappuhr: ${dd}. ${mm}`; }
  else if (kind === 'woche') { inner = clock(46) + plant(150); label = `Klappuhr: ${dd}. ${mm}`; }
  else if (kind === 'vorrat') inner = jar(14, 40, '#D9C3A3') + jar(50, 30, '#8A6A4C') + jar(86, 46, '#C29A5E') + jar(122, 34, '#D9C3A3') + plant(160);
  else inner = jar(24, 40, '#D9C3A3') + jar(60, 30, '#8A6A4C') + jar(96, 46, '#C29A5E') + plant(150);
  return `<svg class="shelf" data-date="${dd}.${mm}" viewBox="0 0 200 142" width="200" height="142" ${label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"'}>${board}${inner}</svg>`;
}
function hueOf(str) { let x = 0; for (const c of str || '') x = (x * 31 + c.charCodeAt(0)) >>> 0; return x % 360; }
function thumb(r, cls = '') {
  const el = h('div', { class: 'thumb ' + cls });
  if (r.image) el.style.backgroundImage = `url("${r.image}")`;
  else {
    const [bgc, fgc] = NATURE_TONES[hueOf(r.title) % NATURE_TONES.length];
    el.style.background = bgc; el.style.color = fgc;
    el.textContent = (r.title || '?').trim().charAt(0).toUpperCase();
  }
  return el;
}
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2400); }

/* ---------- Speicher ---------- */
const Store = {
  mode: 'memory', db: null, mem: new Map(), memkv: new Map(),
  async init() {
    try {
      this.db = await new Promise((res, rej) => {
        const req = indexedDB.open('winter-arc-rezepte', 2);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('recipes')) db.createObjectStore('recipes', { keyPath: 'id' });
          if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv', { keyPath: 'key' });
        };
        req.onsuccess = () => { req.result.onversionchange = () => req.result.close(); res(req.result); };
        req.onerror = () => rej(req.error);
        req.onblocked = () => toast('Bitte schließe andere Tabs mit der Rezept-App, dann geht es weiter.');
        setTimeout(() => rej(new Error('timeout')), 15000);
      });
      await this._tx('readonly', s => s.count());
      this.mode = 'idb'; return;
    } catch (e) { this.db = null; }
    try { localStorage.setItem('__wa_t', '1'); localStorage.removeItem('__wa_t'); this.mode = 'ls'; } catch (e) { this.mode = 'memory'; }
  },
  _tx(mode, fn, store = 'recipes') {
    return new Promise((res, rej) => {
      const tx = this.db.transaction(store, mode); const st = tx.objectStore(store); const r = fn(st);
      tx.oncomplete = () => res(r && r.result); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error);
    });
  },
  async all() {
    if (this.mode === 'idb') return (await this._tx('readonly', s => s.getAll())) || [];
    if (this.mode === 'ls') { try { return JSON.parse(localStorage.getItem('wa_recipes') || '[]'); } catch (e) { return []; } }
    return [...this.mem.values()];
  },
  async putMany(list) {
    if (!list.length) return;
    if (this.mode === 'idb') return this._tx('readwrite', s => { list.forEach(r => s.put(r)); });
    if (this.mode === 'ls') return this._lsWrite();
    list.forEach(r => this.mem.set(r.id, r));
  },
  async del(id) {
    if (this.mode === 'idb') return this._tx('readwrite', s => s.delete(id));
    if (this.mode === 'ls') return this._lsWrite();
    this.mem.delete(id);
  },
  _lsWrite() {
    try { localStorage.setItem('wa_recipes', JSON.stringify(state.recipes)); }
    catch (e) { toast('Speicher voll – bitte Backup exportieren oder Bilder entfernen.'); throw e; }
  },
};
const KV = {
  async get(key, def) {
    try {
      if (Store.mode === 'idb') { const v = await Store._tx('readonly', s => s.get(key), 'kv'); return v ? v.value : def; }
      if (Store.mode === 'ls') { const v = localStorage.getItem('wa_kv_' + key); return v == null ? def : JSON.parse(v); }
      return Store.memkv.has(key) ? Store.memkv.get(key) : def;
    } catch (e) { return def; }
  },
  async set(key, value) {
    try {
      if (Store.mode === 'idb') return await Store._tx('readwrite', s => s.put({ key, value }), 'kv');
      if (Store.mode === 'ls') return localStorage.setItem('wa_kv_' + key, JSON.stringify(value));
      Store.memkv.set(key, value);
    } catch (e) { toast('Speichern fehlgeschlagen. Bitte ein Backup sichern.'); }
  },
};
const _saveT = {};
function persist(key) { clearTimeout(_saveT[key]); _saveT[key] = setTimeout(() => KV.set(key, state[key]), 200); }
const Settings = {
  get(k, d) { try { const v = localStorage.getItem('wa_set_' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('wa_set_' + k, JSON.stringify(v)); } catch (e) {} },
};

/* ---------- Datenmodell ---------- */
function newRecipe() {
  return {
    id: uid(), title: '', subtitle: '', source: '', image: '', servings: 1, prepTime: '', prepMin: '', cookMin: '', totalMin: '', weight: '', warnings: [], warnText: '', ingMacros: true,
    tags: [], ingredients: [newIng()], macroMode: 'auto', manual: { kcal: '', carbs: '', fat: '', protein: '' },
    spiceGroups: [], steps: [''], notes: '', links: [], createdAt: Date.now(), updatedAt: Date.now(),
  };
}
function newIng(o = {}) { return Object.assign({ id: uid(), name: '', amount: '', unit: 'g', kcal: '', carbs: '', fat: '', protein: '', optional: false }, o); }
function normalize(r) {
  const b = newRecipe();
  const out = Object.assign(b, r);
  out.ingredients = (r.ingredients || []).map(i => newIng(i));
  out.spiceGroups = (r.spiceGroups || []).map(g => ({ id: g.id || uid(), name: g.name || '', step: g.step ?? '', spices: (g.spices || []).map(s => ({ name: s.name || '', amount: s.amount || '' })) }));
  out.steps = Array.isArray(r.steps) ? r.steps.map(String) : [];
  out.tags = Array.isArray(r.tags) ? r.tags : [];
  out.links = Array.isArray(r.links) ? r.links : [];
  out.manual = Object.assign({ kcal: '', carbs: '', fat: '', protein: '' }, r.manual || {});
  if (r.prepMin === undefined && r.prepTime) out.prepMin = parseNum(r.prepTime) || '';
  out.tags = [...new Set(out.tags.map(t => t === 'Herzhaft' ? 'Deftig' : t))];
  out.warnings = Array.isArray(r.warnings) ? r.warnings : [];
  if (r.ingMacros === undefined) out.ingMacros = r.macroMode !== 'manual';
  out.macroMode = out.ingMacros ? 'auto' : 'manual';
  // Sicherheit: nur echte, eingebettete Bilder zulassen und Textfelder als Text behandeln
  out.image = safeImage(out.image);
  for (const k of ['title', 'subtitle', 'source', 'notes', 'warnText']) out[k] = out[k] == null ? '' : String(out[k]);
  out.id = String(out.id || uid());
  return out;
}
function safeImage(v) {
  return typeof v === 'string' && /^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(v) ? v : '';
}

function sumIngredients(r, inclOpt) {
  const t = { kcal: 0, carbs: 0, fat: 0, protein: 0 };
  for (const i of r.ingredients) {
    if (i.optional && !inclOpt) continue;
    t.kcal += parseNum(i.kcal); t.carbs += parseNum(i.carbs); t.fat += parseNum(i.fat); t.protein += parseNum(i.protein);
  }
  return t;
}
function totals(r, inclOpt = false) {
  const s = Math.max(1, parseNum(r.servings) || 1);
  if (r.macroMode === 'manual') {
    const p = { kcal: parseNum(r.manual.kcal), carbs: parseNum(r.manual.carbs), fat: parseNum(r.manual.fat), protein: parseNum(r.manual.protein) };
    return { total: mapM(p, v => v * s), portion: p, servings: s };
  }
  const t = sumIngredients(r, inclOpt);
  return { total: t, portion: mapM(t, v => v / s), servings: s };
}
const mapM = (o, f) => ({ kcal: f(o.kcal), carbs: f(o.carbs), fat: f(o.fat), protein: f(o.protein) });
function weightInfo(r, inclOpt) {
  if (parseNum(r.weight) > 0) return { g: parseNum(r.weight), manual: true, skipped: 0 };
  let g = 0, skipped = 0;
  for (const i of r.ingredients) {
    if (i.optional && !inclOpt) continue;
    if (!i.name.trim()) continue;
    const n = parseNum(i.amount); const u = (i.unit || '').toLowerCase();
    if (u === 'g' || u === 'ml') g += n; else if (u === 'kg' || u === 'l') g += n * 1000;
    else if (u !== 'prise') skipped++;
  }
  return g > 0 ? { g, manual: false, skipped } : null;
}
function densityOf(r, inclOpt = false) {
  const w = weightInfo(r, inclOpt); const t = totals(r, inclOpt).total.kcal;
  return (w && t > 0) ? t / w.g * 100 : null;
}
function volBucket(r) { const dn = densityOf(r); return dn == null ? null : volLevel(dn).bucket; }
function volBadge(dn) { const lv = volLevel(dn); return h('span', { class: 'vol-badge lv-' + lv.n }, `${lv.emoji} ${lv.label}`); }
function timesOf(r) {
  const prep = parseNum(r.prepMin), cook = parseNum(r.cookMin), man = parseNum(r.totalMin);
  return { prep, cook, total: man || prep + cook, auto: !man };
}
function fmtMin(m) { m = Math.round(m); if (m < 60) return `${m} Min.`; const hh = Math.floor(m / 60), mm = m % 60; return `${hh} Std.${mm ? ' ' + mm + ' Min.' : ''}`; }
function warnings(r) {
  const out = [];
  const t = timesOf(r).total;
  if (t >= WARN_LIMITS.time) out.push({ level: 'warn', emoji: '⏳', text: `Lange Zubereitung: ${fmtMin(t)} insgesamt` });
  const dn = densityOf(r);
  if (dn != null && dn >= WARN_LIMITS.density) out.push({ level: 'bad', emoji: '🔥', text: `Hohe Kaloriendichte: ${fmt(dn)} kcal pro 100 g` });
  const pk = totals(r).portion.kcal;
  if (pk >= WARN_LIMITS.portion) out.push({ level: 'warn', emoji: '⚖️', text: `Sehr kalorienreich: ${fmt(pk)} kcal pro Portion` });
  for (const o of WARN_OPTIONS) if (r.warnings.includes(o.k)) out.push({ level: o.level, emoji: o.emoji, text: o.text });
  (r.warnText || '').split('\n').map(x => x.trim()).filter(Boolean).forEach(x => out.push({ level: 'info', emoji: '📌', text: x }));
  return out;
}

/* ---------- Zustand ---------- */
const state = { recipes: [], plan: { days: {} }, pantry: { cats: [], items: [] }, shop: [], weekOffset: 0, pq: '', lastRecipeHash: '', q: '', filter: [], filterOpen: false, sort: Settings.get('sort', 'updated'), draft: null, view: { mode: 'portion', inclOpt: false }, cook: {} };
const byId = (id) => state.recipes.find(r => r.id === id);

async function saveRecipe(r) {
  r.updatedAt = Date.now();
  const idx = state.recipes.findIndex(x => x.id === r.id);
  if (idx >= 0) state.recipes[idx] = r; else state.recipes.push(r);
  // Verknüpfungen in beide Richtungen pflegen
  const changed = [r];
  r.links = [...new Set(r.links.filter(id => id !== r.id && byId(id)))];
  for (const o of state.recipes) {
    if (o.id === r.id) continue;
    const should = r.links.includes(o.id), has = o.links.includes(r.id);
    if (should && !has) { o.links.push(r.id); changed.push(o); }
    if (!should && has) { o.links = o.links.filter(x => x !== r.id); changed.push(o); }
  }
  await Store.putMany(changed);
}
async function deleteRecipe(id) {
  state.recipes = state.recipes.filter(r => r.id !== id);
  const changed = [];
  for (const o of state.recipes) if (o.links.includes(id)) { o.links = o.links.filter(x => x !== id); changed.push(o); }
  await Store.del(id);
  await Store.putMany(changed);
}

/* ---------- Routing (Hash) ---------- */
function route() {
  const hsh = location.hash.slice(1);
  if (hsh.startsWith('r-')) return { name: 'view', id: hsh.slice(2) };
  if (hsh.startsWith('e-')) return { name: 'edit', id: hsh.slice(2) };
  if (hsh === 'neu') return { name: 'new' };
  if (TAB_PAGES.includes(hsh)) return { name: hsh };
  return { name: 'home' };
}
const TAB_PAGES = ['woche', 'vorrat', 'einkauf'];
const tabOf = (rt) => TAB_PAGES.includes(rt.name) ? rt.name : 'rezepte';
function go(hash) { if (location.hash === '#' + hash) render(); else location.hash = hash; }
window.addEventListener('hashchange', () => { onRoute(); });
function onRoute() {
  const rt = route();
  if (rt.name === 'edit') { const r = byId(rt.id); state.draft = r ? normalize(JSON.parse(JSON.stringify(r))) : null; }
  else if (rt.name === 'new') { if (!state.draft || state.draft._saved !== false) { state.draft = newRecipe(); state.draft._saved = false; } }
  else state.draft = null;
  if (rt.name !== 'new' && state.draft) delete state.draft._saved;
  if (tabOf(rt) === 'rezepte') state.lastRecipeHash = location.hash;
  render();
  $('#main').scrollTop = 0; $('#tabpage').scrollTop = 0;
}

/* ---------- Rendern ---------- */
function render() {
  const rt = route();
  const tab = tabOf(rt);
  renderTabbar(tab);
  $('#app').hidden = tab !== 'rezepte';
  $('#tabpage').hidden = tab === 'rezepte';
  if (tab !== 'rezepte') {
    document.body.classList.remove('detail-open');
    $('#tabpage').replaceChildren(tab === 'woche' ? weekPage() : tab === 'vorrat' ? pantryPage() : shopPage());
    const head = $('#tabpage .tp-head');
    if (head) {
      head.classList.add('tp-hero-head'); head.insertBefore(h('div', { class: 'shelf-wrap', html: shelfSVG(tab) }), head.children[1] || null);
      let act = head.querySelector('.tp-actions'); if (!act) { act = h('div', { class: 'tp-actions' }); head.append(act); }
      act.append(h('button', { class: 'icon-btn gear', id: 'btn-settings', 'aria-label': 'Einstellungen', onclick: openSettings }, icon('gear')));
    }
    if (tab === 'vorrat') applyPantryFilter();
    renderReminder();
    return;
  }
  document.body.classList.toggle('detail-open', rt.name !== 'home');
  renderSidebar(rt);
  const main = $('#main');
  main.replaceChildren();
  renderReminder();
  if (rt.name === 'view') { const r = byId(rt.id); main.append(r ? viewRecipe(r) : welcome('Rezept nicht gefunden')); }
  else if ((rt.name === 'edit' || rt.name === 'new') && state.draft) main.append(editor(state.draft, rt.name === 'new'));
  else main.append(welcome());
}

function filteredRecipes() {
  const q = state.q.trim().toLowerCase();
  let list = state.recipes.filter(r => {
    if (!matchesFilter(r)) return false;
    if (!q) return true;
    const hay = [r.title, r.subtitle, r.notes, ...r.tags, ...r.ingredients.map(i => i.name), ...r.spiceGroups.flatMap(g => g.spices.map(s => s.name))].join(' ').toLowerCase();
    return hay.includes(q);
  });
  const P = (r) => totals(r).portion;
  const sorts = {
    updated: (a, b) => b.updatedAt - a.updatedAt,
    az: (a, b) => (a.title || '').localeCompare(b.title || '', 'de'),
    protein: (a, b) => P(b).protein - P(a).protein,
    kcal: (a, b) => P(a).kcal - P(b).kcal,
    density: (a, b) => dens(b) - dens(a),
  };
  function dens(r) { const p = P(r); return p.kcal ? p.protein / p.kcal : 0; }
  return list.sort(sorts[state.sort] || sorts.updated);
}

function matchesFilter(r) {
  const groups = {};
  for (const f of state.filter) { const g = f.startsWith('vol:') ? 'vol' : (groupOfTag(f)?.key || 'eigene'); (groups[g] = groups[g] || []).push(f); }
  const hit = (f) => f.startsWith('vol:') ? volBucket(r) === f.slice(4) : r.tags.includes(f);
  return Object.entries(groups).every(([g, fs]) => (g === 'eigene' || TAG_GROUPS.find(x => x.key === g)?.all) ? fs.every(hit) : fs.some(hit));
}
function toggleFilter(f) { state.filter = state.filter.includes(f) ? state.filter.filter(x => x !== f) : [...state.filter, f]; renderSidebar(route()); }
const filterLabel = (f) => f.startsWith('vol:') ? `${VOL_BUCKETS[f.slice(4)].emoji} ${VOL_BUCKETS[f.slice(4)].label}` : tagLabel(f);
function filterPanel() {
  const counts = {}; state.recipes.forEach(r => r.tags.forEach(t => { counts[t] = (counts[t] || 0) + 1; }));
  const vcounts = {}; state.recipes.forEach(r => { const b = volBucket(r); if (b) vcounts[b] = (vcounts[b] || 0) + 1; });
  const groupEl = (g, items) => h('div', { class: 'fp-group' }, h('div', { class: 'fp-label' }, `${g.emoji} ${g.label}`),
    h('div', { class: 'fp-chips' }, items.map(([val, label, n]) => h('button', { class: 'chip' + (state.filter.includes(val) ? ' on' : '') + (n ? '' : ' zero'), 'aria-pressed': state.filter.includes(val) ? 'true' : 'false', 'data-filter': val, onclick: () => toggleFilter(val) },
      label, h('span', { class: 'cnt' }, n || 0)))));
  const custom = Object.keys(counts).filter(t => !groupOfTag(t)).sort((a, b) => a.localeCompare(b, 'de'));
  return h('div', { class: 'filter-panel', id: 'filter-panel' },
    TAG_GROUPS.map(g => groupEl(g, g.tags.map(t => [t, tagLabel(t), counts[t]]))),
    groupEl({ emoji: '🥬', label: 'Volumen (berechnet)' }, Object.entries(VOL_BUCKETS).map(([k, b]) => ['vol:' + k, `${b.emoji} ${b.label}`, vcounts[k]])),
    custom.length ? groupEl({ emoji: '🏷️', label: 'Eigene' }, custom.map(t => [t, t, counts[t]])) : null,
    h('div', { class: 'fp-foot' },
      h('button', { class: 'btn', id: 'filter-reset', onclick: () => { state.filter = []; renderSidebar(route()); } }, 'Zurücksetzen'),
      h('button', { class: 'btn primary', id: 'filter-done', onclick: () => { state.filterOpen = false; renderSidebar(route()); } }, 'Fertig')));
}

function renderSidebar(rt) {
  const sb = $('#sidebar');
  const keepFocus = document.activeElement && document.activeElement.id === 'q';
  const selStart = keepFocus ? document.activeElement.selectionStart : 0;
  sb.replaceChildren();
  const head = h('div', { class: 'side-head' },
    h('div', { class: 'brand' },
      h('div', { class: 'brand-text' }, h('h1', null, 'Eriks Rezepte')),
      h('div', { class: 'shelf-wrap', html: shelfSVG('rezepte') })),
    h('div', { class: 'search-row' },
      h('label', { class: 'search' + (state.q ? ' has-q' : '') }, icon('search'),
        h('input', { id: 'q', type: 'text', inputmode: 'search', enterkeyhint: 'search', autocomplete: 'off', autocorrect: 'off', spellcheck: 'false', placeholder: 'Rezepte, Zutaten, Gewürze', value: state.q, 'aria-label': 'Suchen',
          oninput: (e) => { state.q = e.target.value; e.target.parentNode.classList.toggle('has-q', !!state.q); clearTimeout(searchTimer); searchTimer = setTimeout(refreshList, 450); },
          onkeydown: (e) => { if (e.key === 'Enter') { clearTimeout(searchTimer); refreshList(); e.target.blur(); } } }),
        h('button', { class: 'search-x', type: 'button', 'aria-label': 'Suche löschen', onclick: (e) => { e.preventDefault(); state.q = ''; const q = $('#q'); q.value = ''; q.parentNode.classList.remove('has-q'); clearTimeout(searchTimer); refreshList(); } }, icon('x'))),
      h('button', { class: 'filter-btn' + (state.filter.length ? ' on' : ''), id: 'btn-filter', 'aria-expanded': state.filterOpen ? 'true' : 'false',
        onclick: () => { state.filterOpen = !state.filterOpen; renderSidebar(route()); } },
        icon('filter'), h('span', null, 'Filter'), state.filter.length ? h('span', { class: 'count' }, state.filter.length) : null)),
  );
  if (state.filterOpen) head.querySelector('.search-row').append(filterPanel());
  if (state.filter.length) head.append(h('div', { class: 'active-filters' },
    state.filter.map(f => h('button', { class: 'chip on', 'aria-label': filterLabel(f) + ' entfernen', onclick: () => toggleFilter(f) }, filterLabel(f), icon('x'))),
    h('button', { class: 'link-btn', onclick: () => { state.filter = []; renderSidebar(route()); } }, 'Alle löschen')));
  const list = filteredRecipes();
  const SORTS = [['updated', 'Zuletzt bearbeitet'], ['az', 'A–Z'], ['protein', 'Meiste Proteine'], ['density', 'Beste Proteindichte'], ['kcal', 'Wenigste kcal']];
  head.append(h('div', { class: 'sort-row' },
    h('span', { id: 'rcount' }, `${list.length} ${list.length === 1 ? 'Rezept' : 'Rezepte'}`),
    h('label', { class: 'sort-pick' }, h('span', null, (SORTS.find(x => x[0] === state.sort) || SORTS[0])[1]), icon('down'),
      h('select', { id: 'sort', 'aria-label': 'Sortierung', onchange: (e) => { state.sort = e.target.value; Settings.set('sort', state.sort); renderSidebar(route()); } },
        SORTS.map(([v, l]) => h('option', { value: v, selected: state.sort === v }, l))))));
  sb.append(head);
  sb.append(recipeList(rt, list));
  const bs = backupStatus();
  sb.append(h('div', { class: 'side-foot' },
    h('span', { class: 'bk-hint' + (bs.warn || Store.mode === 'memory' ? ' warn' : ''), id: 'bk-hint' }, Store.mode === 'memory' ? 'Achtung: nicht dauerhaft gespeichert' : bs.short),
    h('button', { class: 'link-btn', id: 'btn-import', onclick: () => $('#file-json').click() }, 'Importieren'),
    h('button', { class: 'link-btn', id: 'btn-menu', onclick: openMenu }, 'Backup'),
    h('button', { class: 'icon-btn gear', id: 'btn-settings-side', 'aria-label': 'Einstellungen', onclick: openSettings }, icon('gear'))));
  if (keepFocus) { const q = $('#q'); q.focus(); try { q.setSelectionRange(selStart, selStart); } catch (e) {} }
}
// Suche: erst tippen lassen, dann nur die Liste neu aufbauen (das Eingabefeld bleibt unberührt)
let searchTimer = 0;
function refreshList() {
  const old = $('#rlist'); if (!old) return;
  const list = filteredRecipes();
  old.replaceWith(recipeList(route(), list));
  const c = $('#rcount'); if (c) c.textContent = `${list.length} ${list.length === 1 ? 'Rezept' : 'Rezepte'}`;
}
function recipeList(rt, list) {
  const activeId = rt.id || (rt.name === 'edit' && state.draft && state.draft.id);
  const ul = h('div', { class: 'list', role: 'list', id: 'rlist' });
  if (!list.length) ul.append(h('div', { class: 'empty-list' }, state.recipes.length ? 'Keine Treffer. Suche oder Filter anpassen.' : 'Noch keine Rezepte. Tippe auf + und leg dein erstes Rezept an.'));
  for (const r of list) {
    const p = totals(r).portion; const vb = volBucket(r); const ws = warnings(r);
    ul.append(h('button', { class: 'list-item' + (r.id === activeId ? ' active' : ''), role: 'listitem', onclick: () => go('r-' + r.id) },
      thumb(r),
      h('div', { style: { minWidth: '0' } },
        h('div', { class: 't' }, r.title || 'Ohne Titel', ws.length ? h('span', { class: 'warn-dot', title: ws.map(w => w.text).join(' · ') }, '⚠️') : null),
        h('div', { class: 'm num' }, vb ? VOL_BUCKETS[vb].emoji + ' ' : '', `${fmt(p.kcal)} kcal · `, h('b', null, `${fmt(p.protein)} g P`), ` · ${fmt(p.carbs)} KH · ${fmt(p.fat)} F`))));
  }
  return ul;
}

function todayCard() {
  const t = new Date(); t.setHours(12, 0, 0, 0);
  const d = state.plan.days[dkey(t)];
  const sh = isWorkDay(d) ? { k: d.shift, label: shiftLabel(d) } : null;
  const filled = d ? (d.meals || []).filter(m => (m.recipeId && byId(m.recipeId)) || m.text) : [];
  const next = filled.find(m => !m.prepared) || filled[0];
  const nm = next ? ((next.recipeId && byId(next.recipeId)) ? byId(next.recipeId).title : next.text) : 'Noch nichts geplant';
  const openN = filled.filter(m => !m.prepared).length;
  return h('button', { class: 'today-card', id: 'today-card', onclick: () => { state.weekOffset = 0; go('woche'); } },
    h('span', { class: 'ti' }, icon(sh ? (sh.k === 'nacht' ? 'moon' : 'sunrise') : d && d.place ? 'pin' : 'calendar')),
    h('span', { class: 'tt' },
      h('small', null, 'Heute · ', sh ? h('span', { style: { color: 'var(--oak-ink)', fontWeight: '600' } }, sh.label) : d && d.place ? h('span', { style: { color: 'var(--accent)', fontWeight: '600' } }, d.place) : 'kein Dienst eingetragen'),
      h('b', null, nm),
      h('small', null, filled.length ? (openN ? `${openN} von ${filled.length} noch nicht vorbereitet` : 'Alles vorbereitet') : 'Im Wochenplan eintragen')),
    icon('next'));
}

function welcome(title) {
  return h('div', { class: 'welcome' },
    (() => { const s = icon('flake'); s.classList.add('flake'); s.setAttribute('stroke-width', '1.4'); return s; })(),
    h('h2', null, title || 'Eriks Rezepte'),
    h('p', null, 'Rezepte aus Instagram sammeln, Makros im Blick behalten, als PDF teilen. Alles bleibt auf diesem Gerät.'),
    h('button', { class: 'btn primary', onclick: () => { state.draft = null; go('neu'); } }, icon('plus'), 'Neues Rezept'));
}

function toolbar(...kids) {
  const tb = h('div', { class: 'toolbar' }, h('button', { class: 'back-btn', onclick: () => go(''), 'aria-label': 'Zurück zur Liste' }, icon('back'), h('span', { class: 'lbl-back' }, 'Rezepte')), ...kids);
  const main = $('#main');
  main.onscroll = () => tb.classList.toggle('scrolled', main.scrollTop > 4);
  return tb;
}

/* ---------- Detailansicht ---------- */
function viewRecipe(r) {
  const wrap = h('div');
  const cook = state.cook[r.id] || (state.cook[r.id] = { ing: new Set(), steps: new Set() });
  wrap.append(toolbar(
    h('div', { class: 'spacer' }),
    h('button', { class: 'btn danger', onclick: () => confirmDelete(r), title: 'Löschen', 'aria-label': 'Löschen' }, icon('trash')),
    h('button', { class: 'btn primary', id: 'btn-edit', 'aria-label': 'Bearbeiten', onclick: () => go('e-' + r.id) }, icon('edit'), h('span', { class: 'lbl-wide' }, 'Bearbeiten'))));

  const page = h('div', { class: 'page' });
  page.append(h('div', { class: 'hero' + (r.image ? '' : ' noimg') }, thumb(r)));

  const meta = h('div', { class: 'meta-row' });
  meta.append(h('span', null, '', `${fmt(parseNum(r.servings) || 1)} ${parseNum(r.servings) === 1 ? 'Portion' : 'Portionen'}`));
  if (r.source) meta.append(isUrl(r.source) ? h('a', { href: r.source, target: '_blank', rel: 'noopener' }, '', shortUrl(r.source)) : h('span', null, '', r.source));
  page.append(h('div', { class: 'title-block' },
    h('h2', null, r.title || 'Ohne Titel'),
    r.subtitle ? h('p', null, r.subtitle) : null, meta));
  if (r.tags.length) page.append(h('div', { class: 'tags' }, r.tags.map(t => h('span', { class: 'chip soft' }, tagLabel(t)))));
  const tm = timesOf(r);
  if (tm.prep || tm.cook || tm.total) page.append(h('div', { class: 'times', id: 'times' },
    [['Vorbereitung', tm.prep], ['Kochzeit', tm.cook], ['Gesamtdauer', tm.total]].map(([l, v], i) =>
      h('div', { class: 'time' + (i === 2 ? ' total' : '') }, h('b', { class: 'num' }, v ? fmtMin(v) : '–'), h('small', null, l)))));
  const ws = warnings(r);
  if (ws.length) page.append(h('section', { class: 'warn-card', id: 'warn-card' }, h('div', { class: 'warn-title' }, 'Hinweise'),
    h('ul', { class: 'warn-list' }, ws.map(w => h('li', { class: 'w-' + w.level }, h('span', { 'aria-hidden': 'true' }, w.emoji), h('span', null, w.text))))));

  page.append(macroCard(r));

  // Zutaten + Gewürze
  const hasOpt = r.ingredients.some(i => i.optional);
  const ingCard = h('section', { class: 'card' },
    h('div', { class: 'sec-title' }, h('h3', null, 'Zutaten'), h('span', { class: 'hint' }, hasOpt ? 'Antippen zum Abhaken' : 'Antippen zum Abhaken')));
  const ul = h('ul', { class: 'ing-list' });
  const ings = [...r.ingredients.filter(i => !i.optional), ...r.ingredients.filter(i => i.optional)].filter(i => i.name);
  if (!ings.length) ul.append(h('li', { class: 'muted', style: { display: 'block' } }, 'Keine Zutaten eingetragen.'));
  for (const i of ings) {
    const li = h('li', { class: cook.ing.has(i.id) ? 'done' : '' });
    const cb = h('input', { type: 'checkbox', class: 'check', checked: cook.ing.has(i.id), 'aria-label': i.name + ' abhaken',
      onchange: (e) => { e.target.checked ? cook.ing.add(i.id) : cook.ing.delete(i.id); li.classList.toggle('done', e.target.checked); } });
    li.append(cb,
      h('span', { class: 'nm' }, i.name, i.optional ? h('span', { class: 'opt-tag' }, 'Optional') : null, inStock(matchPantry(i.name)) ? h('span', { class: 'pbadge have', style: { marginLeft: '6px' }, title: 'Laut Vorratskiste daheim' }, '🫙 da') : null),
      h('span', { class: 'amt num' }, fmtAmt(i.amount, i.unit), parseNum(i.kcal) ? h('span', { class: 'kc' }, `${fmt(parseNum(i.kcal))} kcal · ${fmt(parseNum(i.protein), 1)} g P`) : null));
    li.addEventListener('click', (e) => { if (e.target !== cb) { cb.checked = !cb.checked; cb.dispatchEvent(new Event('change')); } });
    ul.append(li);
  }
  ingCard.append(ul);

  const spCard = h('section', { class: 'card' }, h('div', { class: 'sec-title' }, h('h3', null, 'Gewürze')));
  const groups = r.spiceGroups.filter(g => g.spices.some(s => s.name));
  if (!groups.length) spCard.append(h('p', { class: 'muted', style: { margin: 0 } }, 'Keine Gewürze eingetragen.'));
  for (const g of groups) {
    const stepNo = parseInt(g.step, 10);
    spCard.append(h('div', { class: 'spice-group' },
      h('h4', null, g.name || 'Gewürze', stepNo ? h('em', null, `für Schritt ${stepNo}`) : null),
      h('div', { class: 'spice-chips' }, g.spices.filter(s => s.name).map(s => h('span', { class: 'spice-chip' }, s.name, s.amount ? h('small', null, s.amount) : null)))));
  }
  page.append(h('div', { class: 'two-col' }, ingCard, spCard));

  // Zubereitung
  const steps = r.steps.filter(s => s.trim());
  const stCard = h('section', { class: 'card' }, h('div', { class: 'sec-title' }, h('h3', null, 'Zubereitung'), steps.length ? h('span', { class: 'hint' }, `${steps.length} Schritte`) : null));
  if (!steps.length) stCard.append(h('p', { class: 'muted', style: { margin: 0 } }, 'Noch keine Schritte eingetragen.'));
  else {
    const ol = h('ol', { class: 'steps' });
    r.steps.forEach((s, idx) => {
      if (!s.trim()) return;
      const stepNo = r.steps.slice(0, idx + 1).filter(x => x.trim()).length;
      const sp = r.spiceGroups.filter(g => parseInt(g.step, 10) === stepNo).flatMap(g => g.spices.filter(x => x.name).map(x => x.name + (x.amount ? ' ' + x.amount : '')));
      const li = h('li', { class: cook.steps.has(idx) ? 'done' : '', tabindex: '0', role: 'checkbox', 'aria-checked': cook.steps.has(idx) ? 'true' : 'false' },
        h('div', null, h('div', { class: 'st' }, s), sp.length ? h('div', { class: 'st-sp' }, sp.map(x => h('span', null, x))) : null));
      const tog = () => { cook.steps.has(idx) ? cook.steps.delete(idx) : cook.steps.add(idx); li.classList.toggle('done'); li.setAttribute('aria-checked', cook.steps.has(idx)); };
      li.addEventListener('click', tog); li.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); tog(); } });
      ol.append(li);
    });
    stCard.append(ol);
  }
  page.append(stCard);

  if (r.notes.trim()) page.append(h('section', { class: 'card' }, h('div', { class: 'sec-title' }, h('h3', null, 'Sonstiges')), h('div', { class: 'notes' }, r.notes)));

  const rel = r.links.map(byId).filter(Boolean);
  page.append(h('section', { class: 'card' },
    h('div', { class: 'sec-title' }, h('h3', null, 'Verknüpfte Rezepte')),
    rel.length ? h('div', { class: 'rel-list' }, rel.map(o => { const p = totals(o).portion; return h('button', { class: 'rel', onclick: () => go('r-' + o.id) }, thumb(o), h('div', { style: { minWidth: '0' } }, h('b', null, o.title || 'Ohne Titel'), h('span', { class: 'num' }, `${fmt(p.kcal)} kcal · ${fmt(p.protein)} g Protein`))); }))
      : h('p', { class: 'muted', style: { margin: 0 } }, 'Keine Verknüpfungen. Unter „Bearbeiten“ kannst du Varianten verbinden, z. B. Pancakes → Protein Pancakes mit Birne.')));

  page.append(h('section', { class: 'rec-actions', 'aria-label': 'Aktionen' },
    h('button', { class: 'act', id: 'btn-plan', onclick: () => openPlanDialog(r) }, h('span', { class: 'act-ic' }, icon('calendar')), h('span', { class: 'act-t' }, h('b', null, 'Zu einem Wochentag hinzufügen'), h('small', null, 'Im Wochenplan einplanen')), icon('next')),
    h('button', { class: 'act', id: 'btn-shop', onclick: () => shopRecipe(r) }, h('span', { class: 'act-ic' }, icon('cart')), h('span', { class: 'act-t' }, h('b', null, 'Zutaten zur Einkaufsliste hinzufügen'), h('small', null, 'Mit Portionen und Vorrats-Abgleich')), icon('next')),
    h('button', { class: 'act', id: 'btn-share', onclick: () => openExportDialog(r) }, h('span', { class: 'act-ic' }, icon('share')), h('span', { class: 'act-t' }, h('b', null, 'Rezept exportieren'), h('small', null, 'Als PDF speichern oder als Datei teilen')), icon('next')),
    h('button', { class: 'link-btn act-dup', onclick: () => duplicate(r) }, icon('copy'), 'Rezept duplizieren')));
  wrap.append(page);
  return wrap;
}

function macroCard(r) {
  const card = h('section', { class: 'card', id: 'macro-card' });
  const draw = () => {
    const hasOptMacros = r.macroMode === 'auto' && r.ingredients.some(i => i.optional && parseNum(i.kcal));
    const inclOpt = hasOptMacros && state.view.inclOpt;
    const T = totals(r, inclOpt);
    const v = state.view.mode === 'total' ? T.total : T.portion;
    card.replaceChildren();
    const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Bezug' },
      [['portion', 'Pro Portion'], ['total', 'Gesamt']].map(([k, l]) => h('button', { class: state.view.mode === k ? 'on' : '', 'aria-pressed': state.view.mode === k ? 'true' : 'false', onclick: () => { state.view.mode = k; draw(); } }, l)));
    const head = h('div', { class: 'macro-head' }, h('h3', null, 'Makros'), seg);
    card.append(head);
    if (hasOptMacros) card.append(h('label', { class: 'toggle', style: { marginBottom: '14px' } },
      h('span', { class: 'switch' }, h('input', { type: 'checkbox', id: 'incl-opt', checked: state.view.inclOpt, onchange: (e) => { state.view.inclOpt = e.target.checked; draw(); } }), h('span')),
      'Optionale Zutaten einrechnen'));
    card.append(h('div', { class: 'kcal-row' }, h('span', { class: 'v', id: 'v-kcal' }, fmt(v.kcal)), h('span', { class: 'l' }, state.view.mode === 'total' ? 'kcal gesamt' : 'kcal pro Portion')));
    card.append(h('div', { class: 'macros' },
      MACROS.map(m => h('div', { class: 'macro' }, h('div', { class: 'v num', id: 'v-' + m.k }, fmt(v[m.k], 1), h('span', null, ' g')), h('div', { class: 'bar', style: { background: m.color } }), h('div', { class: 'l' }, m.label)))));
    const e = MACROS.map(m => v[m.k] * m.kcal); const es = e.reduce((a, b) => a + b, 0);
    if (es > 0) {
      card.append(h('div', { class: 'energy-bar', role: 'img', 'aria-label': 'Energieverteilung' }, MACROS.map((m, i) => e[i] > 0 ? h('div', { style: { width: (e[i] / es * 100) + '%', background: m.color } }) : null)));
      card.append(h('div', { class: 'energy-legend num' }, MACROS.map((m, i) => h('span', null, h('i', { class: 'lg-dot', style: { background: m.color } }), `${m.short} ${fmt(e[i] / es * 100)} %`)), h('span', null, 'der Energie')));
    }
    const facts = h('div', { class: 'facts' });
    if (T.portion.kcal > 0) facts.append(h('div', { class: 'fact num' }, 'Proteindichte ', h('b', null, `${fmt(T.portion.protein / T.portion.kcal * 100, 1)} g`), ' Protein pro 100 kcal'));
    if (r.macroMode === 'manual') facts.append(h('div', { class: 'fact' }, 'Makros manuell eingetragen'));
    if (facts.childNodes.length) card.append(facts);
    const w = weightInfo(r, inclOpt);
    const dn = w && T.total.kcal > 0 ? T.total.kcal / w.g * 100 : null;
    if (dn != null) {
      const lv = volLevel(dn);
      card.append(h('div', { class: 'vol', id: 'vol' },
        h('div', { class: 'vol-head' }, h('span', { class: 'vol-title' }, 'Volumen'), volBadge(dn)),
        h('div', { class: 'vol-track', role: 'img', 'aria-label': `${lv.label}, ${fmt(dn)} kcal pro 100 g` }, h('div', { class: 'vol-mark', style: { left: Math.max(2, Math.min(98, dn / 500 * 100)) + '%' } })),
        h('div', { class: 'vol-scale' }, h('span', null, 'viel Volumen, wenig kcal'), h('span', null, 'wenig Volumen, viele kcal')),
        h('div', { class: 'vol-note num' }, `${fmt(dn)} kcal pro 100 g · ${fmt(w.g)} g ${w.manual ? 'Fertiggewicht' : 'Zutaten'}${T.servings > 1 ? ` · ${fmt(w.g / T.servings)} g pro Portion` : ''}${w.skipped ? ` · ${w.skipped} Zutat${w.skipped > 1 ? 'en' : ''} ohne g/ml nicht mitgewogen` : ''}`)));
    } else card.append(h('div', { class: 'vol' }, h('span', { class: 'muted' }, 'Für die Volumen-Einschätzung fehlen Mengen in g oder ml (oder das Fertiggewicht).')));
  };
  draw();
  return card;
}

const isUrl = (s) => /^https?:\/\//i.test(s || '');
const shortUrl = (s) => { try { const u = new URL(s); return u.hostname.replace(/^www\./, '') + (u.pathname.length > 1 ? u.pathname.slice(0, 22) + (u.pathname.length > 22 ? '…' : '') : ''); } catch (e) { return s; } };

async function duplicate(r) {
  const c = normalize(JSON.parse(JSON.stringify(r)));
  c.id = uid(); c.title = (r.title || 'Rezept') + ' (Variante)'; c.createdAt = Date.now(); c.example = false;
  c.links = [r.id];
  c.ingredients.forEach(i => i.id = uid());
  await saveRecipe(c);
  toast('Variante erstellt und verknüpft');
  go('e-' + c.id);
}

/* ---------- Dialoge ---------- */
function openDialog(title, body, actions) {
  const d = $('#dlg');
  d.replaceChildren(h('div', { class: 'dlg' },
    h('div', { class: 'dlg-head' }, h('h3', null, title), h('button', { class: 'icon-btn', 'aria-label': 'Schließen', onclick: () => d.close() }, icon('x'))),
    h('div', { class: 'dlg-body' }, body),
    actions ? h('div', { class: 'dlg-foot' }, actions) : null));
  if (!d.open) d.showModal();
  return d;
}
function confirmDelete(r) {
  openDialog('Rezept löschen?', h('p', null, `„${r.title || 'Ohne Titel'}“ wird von diesem Gerät entfernt. Verknüpfungen zu anderen Rezepten werden ebenfalls gelöst.`), [
    h('button', { class: 'btn', onclick: () => $('#dlg').close() }, 'Abbrechen'),
    h('button', { class: 'btn primary', id: 'confirm-del', style: { background: 'var(--danger)' }, onclick: async () => { await deleteRecipe(r.id); $('#dlg').close(); toast('Rezept gelöscht'); go(''); render(); } }, 'Löschen')]);
}
/* =========================================================
   Backup, Wiederherstellen, Rezepte teilen
   Alles bleibt auf dem Gerät. Daten verlassen es nur, wenn du
   selbst ein Backup sicherst oder ein Rezept teilst.
   ========================================================= */
const BACKUP_DAYS = 7;
const MAX_IMPORT_BYTES = 300 * 1024 * 1024;
function fmtBytes(b) { if (b < 1024) return `${b} Byte`; if (b < 1024 * 1024) return `${fmt(b / 1024, 0)} KB`; return `${fmt(b / 1024 / 1024, 1)} MB`; }
function slugify(t) { return (t || 'rezept').toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'rezept'; }
function relDays(ts) {
  const d = Math.floor((Date.now() - ts) / 864e5);
  return d <= 0 ? 'heute' : d === 1 ? 'gestern' : `vor ${d} Tagen`;
}
function hasOwnData() {
  return state.recipes.some(r => !r.example) || Object.values(state.plan.days || {}).some(d => (d.meals || []).some(m => m.recipeId || m.text) || d.shift || d.place) || state.shop.length > 0;
}
function backupStatus() {
  const last = Settings.get('lastBackup', 0);
  const warn = hasOwnData() && (!last || Date.now() - last > BACKUP_DAYS * 864e5);
  return { last, warn, short: last ? `Letztes Backup ${relDays(last)}` : 'Noch kein Backup', long: last ? `Letztes Backup: ${relDays(last)} (${new Date(last).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })})` : 'Du hast noch kein Backup gesichert.' };
}
function buildBackup(withPhotos = true) {
  const recipes = withPhotos ? state.recipes : state.recipes.map(r => Object.assign({}, r, { image: '' }));
  return { app: 'eriks-rezepte', type: 'backup', version: 3, exportedAt: new Date().toISOString(), withPhotos,
    counts: { recipes: state.recipes.length, days: Object.keys(state.plan.days || {}).length, pantry: state.pantry.items.length, shop: state.shop.length },
    recipes, plan: state.plan, pantry: state.pantry, shop: state.shop };
}
const isTouchDevice = () => matchMedia('(pointer: coarse)').matches || navigator.standalone === true;
// Datei übergeben: iPhone → Teilen-Menü („In Dateien sichern“, AirDrop …), Mac → Speicherort wählen oder Downloads
async function saveFile(filename, text, title) {
  const blob = new Blob([text], { type: 'application/json' });
  if (isTouchDevice() && navigator.canShare && typeof File === 'function') {
    const file = new File([blob], filename, { type: 'application/json' });
    if (navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title }); return 'shared'; }
      catch (e) { if (e && e.name === 'AbortError') return 'aborted'; }
    }
  }
  if (window.showSaveFilePicker) {
    try {
      const hnd = await window.showSaveFilePicker({ suggestedName: filename, types: [{ description: 'Rezept-Datei (JSON)', accept: { 'application/json': ['.json'] } }] });
      const w = await hnd.createWritable(); await w.write(blob); await w.close(); return 'saved';
    } catch (e) { if (e && e.name === 'AbortError') return 'aborted'; }
  }
  const a = h('a', { href: URL.createObjectURL(blob), download: filename });
  document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  return 'downloaded';
}
async function exportBackup(withPhotos = true) {
  const text = JSON.stringify(buildBackup(withPhotos));
  const name = `eriks-rezepte-backup-${new Date().toISOString().slice(0, 10)}${withPhotos ? '' : '-ohne-fotos'}.json`;
  const res = await saveFile(name, text, 'Eriks Rezepte – Backup');
  if (res === 'aborted') return toast('Backup abgebrochen');
  Settings.set('lastBackup', Date.now());
  toast(`Backup gesichert (${fmtBytes(new Blob([text]).size)})`);
  renderSidebar(route());
  if ($('#dlg').open && $('#bk-dialog')) openMenu();
}
// Kompatibilität für ältere Aufrufe
function exportJSON() { return exportBackup(true); }
function openExportDialog(r) {
  openDialog('Rezept exportieren', h('div', { class: 'rec-actions', style: { margin: '0', padding: '0', background: 'none', boxShadow: 'none' } },
    h('button', { class: 'act', id: 'exp-pdf', onclick: () => { $('#dlg').close(); printRecipe(r); } }, h('span', { class: 'act-ic' }, icon('pdf')),
      h('span', { class: 'act-t' }, h('b', null, 'Als PDF speichern'), h('small', null, 'Zum Ausdrucken oder Weitergeben. Im Druckmenü auf Teilen tippen und „In Dateien sichern“ wählen.'))),
    h('button', { class: 'act', id: 'exp-file', onclick: () => { $('#dlg').close(); exportRecipe(r); } }, h('span', { class: 'act-ic' }, icon('share')),
      h('span', { class: 'act-t' }, h('b', null, 'Als Rezept-Datei teilen'), h('small', null, 'Für die App: Wer die Datei importiert, bekommt das Rezept vollständig mit Foto.')))),
    [h('button', { class: 'btn', onclick: () => $('#dlg').close() }, 'Abbrechen')]);
}
async function exportRecipe(r) {
  const rec = JSON.parse(JSON.stringify(r)); rec.links = []; delete rec.example;
  const data = { app: 'eriks-rezepte', type: 'rezept', version: 1, exportedAt: new Date().toISOString(), recipe: rec,
    linkedTitles: r.links.map(byId).filter(Boolean).map(o => o.title) };
  const res = await saveFile(`rezept-${slugify(r.title)}.json`, JSON.stringify(data), `Rezept: ${r.title || 'Ohne Titel'}`);
  if (res !== 'aborted') toast('Rezept-Datei erstellt');
}
async function openMenu() {
  const bs = backupStatus();
  const sizeWith = new Blob([JSON.stringify(buildBackup(true))]).size;
  const sizeWithout = new Blob([JSON.stringify(buildBackup(false))]).size;
  const photos = state.recipes.filter(r => r.image).length;
  const undo = await KV.get('undo', null);
  let persisted = null, usage = null;
  try { if (navigator.storage && navigator.storage.persisted) persisted = await navigator.storage.persisted(); } catch (e) {}
  try { if (navigator.storage && navigator.storage.estimate) usage = (await navigator.storage.estimate()).usage; } catch (e) {}
  const c = buildBackup(false).counts;
  const where = isTouchDevice()
    ? 'Beim Sichern öffnet sich das Teilen-Menü. Wähle „In Dateien sichern“ und dann iCloud Drive oder „Auf meinem iPhone“. Du kannst die Datei auch per AirDrop an deinen Mac schicken.'
    : 'Beim Sichern wählst du den Ordner selbst, zum Beispiel iCloud Drive. Je nach Browser landet die Datei sonst im Ordner „Downloads“.';
  openDialog('Backup & Daten', h('div', { id: 'bk-dialog', style: { display: 'flex', flexDirection: 'column', gap: '16px' } },
    h('section', { class: 'bk' },
      h('h4', null, 'Gesamt-Backup'),
      h('p', { class: 'bk-note' }, 'Enthält alle Rezepte inklusive Fotos, deine Wochenplanung, die Vorratskiste und die Einkaufsliste in einer Datei.'),
      h('div', { class: 'bk-stats num' },
        h('div', null, h('b', null, c.recipes), h('small', null, 'Rezepte')),
        h('div', null, h('b', null, c.days), h('small', null, 'Tage im Plan')),
        h('div', null, h('b', null, c.pantry), h('small', null, 'Vorratsartikel')),
        h('div', null, h('b', null, c.shop), h('small', null, 'Einkaufsliste'))),
      h('div', { class: 'bk-status' + (bs.warn ? ' warn' : ''), id: 'bk-status' }, bs.long + (bs.warn ? ` Sichere am besten jetzt, spätestens alle ${BACKUP_DAYS} Tage.` : '')),
      h('div', { class: 'bk-row' },
        h('button', { class: 'btn primary', id: 'bk-save', onclick: () => exportBackup(true) }, icon('share'), `Backup sichern · ${fmtBytes(sizeWith)}`),
        photos ? h('button', { class: 'btn', id: 'bk-save-small', onclick: () => exportBackup(false) }, `Ohne Fotos · ${fmtBytes(sizeWithout)}`) : null),
      h('p', { class: 'bk-note' }, where)),
    h('section', { class: 'bk' },
      h('h4', null, 'Wiederherstellen & importieren'),
      h('p', { class: 'bk-note' }, 'Wähle ein Gesamt-Backup oder eine einzelne Rezept-Datei. Du siehst vorher, was übernommen wird.'),
      h('div', { class: 'bk-row' },
        h('button', { class: 'btn', id: 'bk-import', onclick: () => $('#file-json').click() }, icon('import'), 'Datei auswählen'),
        undo ? h('button', { class: 'btn', id: 'bk-undo', onclick: undoImport }, `Import vom ${new Date(undo.at).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })} rückgängig machen`) : null)),
    h('section', { class: 'bk' },
      h('h4', null, 'Speicher auf diesem Gerät'),
      h('p', { class: 'bk-note' },
        { idb: 'Deine Daten liegen in der Datenbank dieses Browsers bzw. dieser App.', ls: 'Deine Daten liegen im Browser-Speicher.', memory: 'Dieser Browser speichert nicht dauerhaft. Sichere unbedingt ein Backup.' }[Store.mode],
        usage != null ? ` Belegt: ${fmtBytes(usage)}.` : '',
        persisted === true ? ' Das Gerät hat den Speicher als dauerhaft markiert.' : persisted === false ? ' Das Gerät darf die Daten bei Speicherknappheit löschen, deshalb sind Backups wichtig.' : ''),
      h('p', { class: 'bk-note' }, 'Die App sendet nichts ins Internet. Daten verlassen dieses Gerät nur, wenn du ein Backup sicherst oder ein Rezept teilst.')),
  ), [h('button', { class: 'btn', onclick: () => $('#dlg').close() }, 'Fertig')]);
}

// ---------- Import ----------
function detectImport(data) {
  if (data && data.type === 'rezept' && data.recipe && typeof data.recipe === 'object') return { kind: 'recipe', recipe: normalize(data.recipe), linkedTitles: Array.isArray(data.linkedTitles) ? data.linkedTitles.map(String) : [] };
  if (Array.isArray(data)) return { kind: 'backup', recipes: data.map(normalize), plan: null, pantry: null, shop: null, at: null };
  if (data && Array.isArray(data.recipes)) return { kind: 'backup', recipes: data.recipes.filter(x => x && typeof x === 'object').map(normalize),
    plan: validPlan(data.plan), pantry: validPantry(data.pantry), shop: Array.isArray(data.shop) ? data.shop.filter(i => i && typeof i.name === 'string') : null, at: data.exportedAt || null };
  if (data && typeof data === 'object' && typeof data.title === 'string' && Array.isArray(data.ingredients)) return { kind: 'recipe', recipe: normalize(data), linkedTitles: [] };
  return null;
}
const validPlan = (p) => p && typeof p === 'object' && p.days && typeof p.days === 'object' ? { days: p.days } : null;
const validPantry = (p) => p && Array.isArray(p.cats) && Array.isArray(p.items) ? { cats: p.cats.filter(c => c && c.id), items: p.items.filter(i => i && typeof i.name === 'string') } : null;
async function snapshotForUndo() {
  await KV.set('undo', { at: Date.now(), recipes: JSON.parse(JSON.stringify(state.recipes)), plan: JSON.parse(JSON.stringify(state.plan)), pantry: JSON.parse(JSON.stringify(state.pantry)), shop: JSON.parse(JSON.stringify(state.shop)) });
}
async function replaceAllRecipes(list) {
  state.recipes = list;
  if (Store.mode === 'idb') { await Store._tx('readwrite', s => s.clear()); await Store.putMany(list); }
  else if (Store.mode === 'ls') Store._lsWrite();
  else { Store.mem.clear(); list.forEach(r => Store.mem.set(r.id, r)); }
}
async function applyBackup(imp, mode) {
  await snapshotForUndo();
  if (mode === 'replace') {
    await replaceAllRecipes(imp.recipes);
    if (imp.plan) state.plan = imp.plan;
    if (imp.pantry) state.pantry = imp.pantry;
    if (imp.shop) state.shop = imp.shop;
  } else {
    const changed = [];
    for (const r of imp.recipes) {
      const i = state.recipes.findIndex(x => x.id === r.id);
      if (i < 0) { state.recipes.push(r); changed.push(r); }
      else if ((r.updatedAt || 0) >= (state.recipes[i].updatedAt || 0)) { state.recipes[i] = r; changed.push(r); }
    }
    if (Store.mode === 'ls') Store._lsWrite(); else await Store.putMany(changed);
    if (imp.plan) Object.assign(state.plan.days, imp.plan.days);
    if (imp.pantry) {
      const catMap = {};
      for (const c of imp.pantry.cats) {
        let own = state.pantry.cats.find(x => x.name === c.name);
        if (!own) { own = { id: uid(), name: c.name, emoji: c.emoji || '📦' }; state.pantry.cats.push(own); }
        catMap[c.id] = own.id;
      }
      for (const it of imp.pantry.items) {
        if (state.pantry.items.some(x => shopNorm(x.name) === shopNorm(it.name))) continue;
        state.pantry.items.push(Object.assign({}, it, { id: uid(), catId: catMap[it.catId] || (state.pantry.cats[0] && state.pantry.cats[0].id) }));
      }
    }
    if (imp.shop) for (const it of imp.shop) if (!state.shop.some(x => !x.done && shopNorm(x.name) === shopNorm(it.name))) state.shop.push(Object.assign({}, it, { id: uid() }));
  }
  for (const k of ['plan', 'pantry', 'shop']) await KV.set(k, state[k]);
  state.cook = {};
}
async function undoImport() {
  const u = await KV.get('undo', null); if (!u) return;
  await replaceAllRecipes(u.recipes.map(normalize));
  state.plan = u.plan; state.pantry = u.pantry; state.shop = u.shop;
  for (const k of ['plan', 'pantry', 'shop']) await KV.set(k, state[k]);
  await KV.set('undo', null);
  $('#dlg').open && $('#dlg').close();
  toast('Import rückgängig gemacht'); render();
}
function openImportDialog(imp) {
  if (imp.kind === 'recipe') {
    const r = imp.recipe; const exists = byId(r.id); const p = totals(r).portion;
    const doImport = async (asCopy) => {
      const rec = normalize(JSON.parse(JSON.stringify(r)));
      if (asCopy) { rec.id = uid(); if (exists) rec.title = rec.title + ' (Kopie)'; rec.ingredients.forEach(i => i.id = uid()); }
      rec.links = rec.links.filter(id => byId(id)); rec.example = false; rec.updatedAt = Date.now();
      await saveRecipe(rec);
      $('#dlg').close(); toast('Rezept importiert'); go('r-' + rec.id);
    };
    openDialog('Rezept importieren', [
      h('div', { class: 'rel', style: { cursor: 'default' } }, thumb(r), h('div', { style: { minWidth: '0' } }, h('b', null, r.title || 'Ohne Titel'), h('span', { class: 'num' }, `${fmt(p.kcal)} kcal · ${fmt(p.protein)} g Protein · ${r.ingredients.length} Zutaten`))),
      exists ? h('p', null, `Das Rezept „${exists.title}“ gibt es schon. Du kannst es ersetzen oder als Kopie hinzufügen.`) : null,
      imp.linkedTitles.length ? h('p', null, `Verknüpfungen (${imp.linkedTitles.join(', ')}) werden nicht mitgenommen.`) : null,
    ], [
      h('button', { class: 'btn', onclick: () => $('#dlg').close() }, 'Abbrechen'),
      exists ? h('button', { class: 'btn', id: 'imp-copy', onclick: () => doImport(true) }, 'Als Kopie hinzufügen') : null,
      h('button', { class: 'btn primary', id: 'imp-ok', onclick: () => doImport(false) }, exists ? 'Ersetzen' : 'Importieren'),
    ]);
    return;
  }
  let mode = 'merge';
  const days = imp.plan ? Object.keys(imp.plan.days).length : 0;
  const newR = imp.recipes.filter(r => !byId(r.id)).length;
  const choice = (val, title, text) => h('label', { class: 'choice' },
    h('input', { type: 'radio', name: 'imp-mode', value: val, checked: val === mode, onchange: () => { mode = val; } }), h('div', null, h('b', null, title), h('span', null, text)));
  openDialog('Backup wiederherstellen', [
    h('p', null, imp.at ? `Backup vom ${new Date(imp.at).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })}` : 'Backup-Datei'),
    h('div', { class: 'bk-stats num' },
      h('div', null, h('b', null, imp.recipes.length), h('small', null, `Rezepte, ${newR} neu`)),
      h('div', null, h('b', null, days), h('small', null, 'Tage im Plan')),
      h('div', null, h('b', null, imp.pantry ? imp.pantry.items.length : 0), h('small', null, 'Vorratsartikel')),
      h('div', null, h('b', null, imp.shop ? imp.shop.length : 0), h('small', null, 'Einkaufsliste'))),
    choice('merge', 'Zusammenführen (empfohlen)', 'Neue Rezepte kommen dazu, bei gleichen Rezepten gewinnt die neuere Fassung. Tage aus dem Backup überschreiben dieselben Tage hier. Vorrat und Einkaufsliste werden ergänzt.'),
    choice('replace', 'Alles ersetzen', 'Dieses Gerät übernimmt genau den Stand des Backups. Rezepte, die nicht im Backup sind, werden entfernt.'),
    h('p', null, 'Vor dem Import merkt sich die App den aktuellen Stand. Unter „Backup“ kannst du den Import rückgängig machen.'),
  ], [
    h('button', { class: 'btn', onclick: () => $('#dlg').close() }, 'Abbrechen'),
    h('button', { class: 'btn primary', id: 'imp-ok', onclick: async () => {
      await applyBackup(imp, mode); $('#dlg').close();
      toast(mode === 'replace' ? 'Backup wiederhergestellt' : 'Backup zusammengeführt'); go(''); render();
    } }, 'Übernehmen'),
  ]);
}
document.addEventListener('mousedown', (e) => {
  if (!state.filterOpen) return;
  if (e.target.closest('#filter-panel') || e.target.closest('#btn-filter')) return;
  state.filterOpen = false; renderSidebar(route());
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && state.filterOpen) { state.filterOpen = false; renderSidebar(route()); } });
$('#file-json').addEventListener('change', async (e) => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  if (f.size > MAX_IMPORT_BYTES) return toast('Die Datei ist zu groß für ein Rezept-Backup.');
  let imp = null;
  try { imp = detectImport(JSON.parse(await f.text())); } catch (err) { imp = null; }
  if (!imp || (imp.kind === 'backup' && !imp.recipes.length && !imp.plan && !imp.pantry)) return toast('Diese Datei ist kein Backup und kein Rezept aus der App.');
  openImportDialog(imp);
});

/* ---------- Editor ---------- */
function editor(d, isNew) {
  const wrap = h('div');
  wrap.append(toolbar(
    h('div', { class: 'tb-title' }, isNew ? 'Neues Rezept' : 'Bearbeiten'),
    h('div', { class: 'spacer' }),
    h('button', { class: 'btn', onclick: () => { state.draft = null; go(isNew ? '' : 'r-' + d.id); } }, 'Abbrechen'),
    h('button', { class: 'btn primary', id: 'btn-save', onclick: async () => {
      if (!d.title.trim()) { toast('Bitte gib dem Rezept einen Titel.'); $('#f-title').focus(); return; }
      const clean = normalize(JSON.parse(JSON.stringify(d)));
      delete clean._saved;
      clean.ingredients = clean.ingredients.filter(i => i.name.trim() || parseNum(i.kcal));
      clean.steps = clean.steps.filter(s => s.trim());
      clean.spiceGroups = clean.spiceGroups.map(g => ({ ...g, spices: g.spices.filter(s => s.name.trim()) })).filter(g => g.name.trim() || g.spices.length);
      try { await saveRecipe(clean); } catch (e) { return; }
      state.draft = null; toast('Gesichert'); go('r-' + clean.id);
    } }, 'Sichern')));

  const page = h('div', { class: 'page' });

  // Bild
  const img = h('div', { class: 'img-pick' + (d.image ? ' has' : ''), tabindex: '0', role: 'button', 'aria-label': 'Bild auswählen' });
  const drawImg = () => {
    img.replaceChildren(); img.classList.toggle('has', !!d.image);
    if (d.image) img.append(h('img', { src: d.image, alt: '' }), h('div', { class: 'img-actions' },
      h('button', { class: 'btn', onclick: (e) => { e.stopPropagation(); pickImage(); } }, 'Ändern'),
      h('button', { class: 'btn', onclick: (e) => { e.stopPropagation(); d.image = ''; drawImg(); } }, 'Entfernen')));
    else img.append(h('div', { class: 'ph' }, icon('image'), h('b', { style: { color: 'var(--fg)' } }, 'Foto hinzufügen'), (matchMedia('(pointer: coarse)').matches ? 'Foto aufnehmen oder aus der Mediathek wählen.' : 'Screenshot aus Instagram oder eigenes Foto. Auch per Einfügen (⌘V) oder Ziehen.')));
  };
  onImagePicked = async (f) => { d.image = await resizeImage(f); drawImg(); };
  const pickImage = () => $('#file-img').click();
  img.addEventListener('click', pickImage);
  img.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pickImage(); } });
  img.addEventListener('dragover', (e) => e.preventDefault());
  img.addEventListener('drop', async (e) => { e.preventDefault(); const f = [...e.dataTransfer.files].find(f => f.type.startsWith('image/')); if (f) { d.image = await resizeImage(f); drawImg(); } });
  editor._paste && document.removeEventListener('paste', editor._paste);
  editor._paste = async (e) => { if (!state.draft) return; const f = [...(e.clipboardData?.files || [])].find(f => f.type.startsWith('image/')); if (f) { e.preventDefault(); d.image = await resizeImage(f); drawImg(); toast('Bild eingefügt'); } };
  document.addEventListener('paste', editor._paste);
  drawImg();
  page.append(img);

  // Grunddaten
  const autoTotalPh = () => { const sm = parseNum(d.prepMin) + parseNum(d.cookMin); return sm ? `automatisch: ${fmtMin(sm)}` : 'wird automatisch addiert'; };
  const totalIn = h('input', { id: 'f-total', inputmode: 'numeric', value: d.totalMin, placeholder: autoTotalPh() });
  const bind = (key, el) => { el.addEventListener('input', () => { d[key] = el.value; if (key === 'servings') updateSum(); if (key === 'prepMin' || key === 'cookMin') totalIn.placeholder = autoTotalPh(); }); return el; };
  page.append(h('div', { class: 'form-sec' },
    h('div', { class: 'group' },
      h('div', { class: 'row' }, bind('title', h('input', { id: 'f-title', class: 'title-input', placeholder: 'Rezepttitel', value: d.title, 'aria-label': 'Titel' }))),
      h('div', { class: 'row' }, bind('subtitle', h('input', { id: 'f-sub', placeholder: 'Kurzbeschreibung (optional)', value: d.subtitle, 'aria-label': 'Kurzbeschreibung' })))),
    h('div', { class: 'group' },
      h('div', { class: 'row' }, h('label', { for: 'f-serv' }, 'Portionen'), bind('servings', h('input', { id: 'f-serv', inputmode: 'decimal', value: d.servings, placeholder: '1' }))),
      h('div', { class: 'row' }, h('label', { for: 'f-src' }, 'Quelle'), bind('source', h('input', { id: 'f-src', placeholder: 'Instagram-Link oder Name des Accounts', value: d.source })))),
    h('div', { class: 'group' },
      h('div', { class: 'row' }, h('label', { for: 'f-prep' }, 'Vorbereitung'), bind('prepMin', h('input', { id: 'f-prep', inputmode: 'numeric', placeholder: 'Minuten', value: d.prepMin }))),
      h('div', { class: 'row' }, h('label', { for: 'f-cook' }, 'Kochzeit'), bind('cookMin', h('input', { id: 'f-cook', inputmode: 'numeric', placeholder: 'Minuten', value: d.cookMin }))),
      h('div', { class: 'row' }, h('label', { for: 'f-total' }, 'Gesamtdauer'), bind('totalMin', totalIn)))));

  // Kategorien
  const tagBox = h('div', { class: 'tag-pick' });
  const drawTags = () => {
    tagBox.replaceChildren();
    const chip = (t, label) => h('button', { class: 'chip' + (d.tags.includes(t) ? ' on' : ''), 'aria-pressed': d.tags.includes(t) ? 'true' : 'false', 'data-tag': t,
      onclick: () => { d.tags = d.tags.includes(t) ? d.tags.filter(x => x !== t) : [...d.tags, t]; drawTags(); } }, label);
    TAG_GROUPS.forEach(g => tagBox.append(h('div', null, h('div', { class: 'fp-label' }, `${g.emoji} ${g.label}`), h('div', { class: 'fp-chips' }, g.tags.map(t => chip(t, tagLabel(t)))))));
    const custom = [...new Set([...state.recipes.flatMap(r => r.tags), ...d.tags])].filter(t => !groupOfTag(t));
    const inp = h('input', { class: 'field', id: 'f-newtag', placeholder: 'Eigene Kategorie', 'aria-label': 'Eigene Kategorie',
      onkeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } } });
    const add = () => { const v = inp.value.trim(); if (v && !d.tags.includes(v)) d.tags.push(v); drawTags(); $('#f-newtag').focus(); };
    tagBox.append(h('div', null, h('div', { class: 'fp-label' }, 'Eigene'), h('div', { class: 'fp-chips' }, custom.map(t => chip(t, t)),
      h('span', { class: 'add-inline' }, inp, h('button', { class: 'icon-btn', 'aria-label': 'Kategorie hinzufügen', onclick: add }, icon('plus'))))));
  };
  drawTags();
  page.append(h('div', { class: 'form-sec' }, h('span', { class: 'cap' }, 'Kategorien'), h('div', { class: 'group' }, tagBox)));

  // Zutaten
  let scaleOn = Settings.get('scale', true);
  const ingBox = h('div', { class: 'ing-table' });
  const sumEl = h('div', { class: 'ing-total num' });
  function updateSum() {
    const t = sumIngredients(d, false), to = sumIngredients(d, true);
    const optDiff = to.kcal - t.kcal;
    sumEl.replaceChildren(h('span', { class: 'hide-m' }), h('span', null, 'Summe', optDiff > 0 ? h('span', { class: 'muted', style: { fontWeight: '400', fontSize: '12px', marginLeft: '6px' } }, `+${fmt(optDiff)} kcal optional`) : ''),
      h('span', { class: 'hide-m' }), h('span', { class: 'hide-m' }),
      h('span', { class: 'r' }, `${fmt(t.kcal)} kcal`), h('span', { class: 'r' }, `${fmt(t.carbs, 1)} KH`), h('span', { class: 'r' }, `${fmt(t.fat, 1)} F`), h('span', { class: 'r' }, `${fmt(t.protein, 1)} P`), h('span', { class: 'hide-m' }));
    drawMacroMode(true);
  }
  const drawIngs = () => {
    ingBox.classList.toggle('no-mac', !d.ingMacros);
    ingBox.replaceChildren(h('div', { class: 'ing-head' }, h('span', { title: 'Optional' }, 'Opt.'), h('span', null, 'Zutat'), h('span', { class: 'r' }, 'Menge'), h('span', null, 'Einheit'), h('span', { class: 'r mh' }, 'kcal'), h('span', { class: 'r mh' }, 'KH g'), h('span', { class: 'r mh' }, 'Fett g'), h('span', { class: 'r mh' }, 'Prot. g'), h('span')));
    d.ingredients.forEach((ing, idx) => {
      const numIn = (k, lab) => h('label', null, h('span', { class: 'mlab' }, lab),
        h('input', { class: 'field r', inputmode: 'decimal', value: fmtIn(ing[k]), 'aria-label': lab + ' ' + (ing.name || 'Zutat ' + (idx + 1)), 'data-k': k,
          oninput: (e) => { ing[k] = e.target.value; updateSum(); } }));
      const amtIn = h('input', { class: 'field r c-amt', inputmode: 'decimal', value: fmtIn(ing.amount), placeholder: '–', 'aria-label': 'Menge',
        onfocus: (e) => { e.target.dataset.old = ing.amount; },
        onchange: (e) => {
          const oldA = parseNum(e.target.dataset.old), newA = parseNum(e.target.value);
          ing.amount = e.target.value;
          if (scaleOn && oldA > 0 && newA > 0 && oldA !== newA && ['kcal', 'carbs', 'fat', 'protein'].some(k => parseNum(ing[k]))) {
            const f = newA / oldA;
            ['kcal', 'carbs', 'fat', 'protein'].forEach(k => { if (ing[k] !== '') ing[k] = Math.round(parseNum(ing[k]) * f * 10) / 10; });
            row.querySelectorAll('[data-k]').forEach(el => el.value = fmtIn(ing[el.dataset.k]));
            toast(`Makros auf ${fmt(newA, 1)} ${ing.unit} umgerechnet`);
          }
          e.target.dataset.old = ing.amount; updateSum();
        } });
      const row = h('div', { class: 'ing-row', 'data-idx': idx },
        h('label', { class: 'c-opt', title: 'Optional: passt gut, ist aber nicht nötig' },
          h('input', { type: 'checkbox', class: 'check square', checked: ing.optional, 'aria-label': 'Optional', onchange: (e) => { ing.optional = e.target.checked; updateSum(); } }),
          h('span', { class: 'opt-lbl' }, 'Zutat optional')),
        h('input', { class: 'field c-name', value: ing.name, placeholder: 'z. B. Magerquark', 'aria-label': 'Zutat', list: 'ing-names', oninput: (e) => { ing.name = e.target.value; } }),
        amtIn,
        h('select', { class: 'field c-unit', 'aria-label': 'Einheit', onchange: (e) => { ing.unit = e.target.value; updateSum(); } },
          [...new Set([...UNITS, ing.unit].filter(Boolean))].map(u => h('option', { value: u, selected: ing.unit === u }, u))),
        h('div', { class: 'c-mac' }, numIn('kcal', 'kcal'), numIn('carbs', 'KH'), numIn('fat', 'Fett'), numIn('protein', 'Protein')),
        h('div', { class: 'row-btns' },
          h('button', { class: 'mini', 'aria-label': 'Nach oben', disabled: idx === 0, onclick: () => { move(d.ingredients, idx, -1); drawIngs(); } }, icon('up')),
          h('button', { class: 'mini', 'aria-label': 'Nach unten', disabled: idx === d.ingredients.length - 1, onclick: () => { move(d.ingredients, idx, 1); drawIngs(); } }, icon('down')),
          h('button', { class: 'mini del', 'aria-label': 'Zutat entfernen', onclick: () => { d.ingredients.splice(idx, 1); drawIngs(); } }, icon('trash'))));
      ingBox.append(row);
    });
    ingBox.append(sumEl);
    updateSum();
  };
  const datalist = h('datalist', { id: 'ing-names' }, [...new Set(state.recipes.flatMap(r => r.ingredients.map(i => i.name)).filter(Boolean))].map(n => h('option', { value: n })));
  const scaleWrap = h('label', { class: 'toggle', hidden: !d.ingMacros }, h('span', { class: 'switch' }, h('input', { type: 'checkbox', id: 'f-scale', checked: scaleOn, onchange: (e) => { scaleOn = e.target.checked; Settings.set('scale', scaleOn); } }), h('span')), 'Makros mit Menge umrechnen');
  const syncMacroMode = () => { $('#f-ingmac').checked = d.ingMacros; scaleWrap.hidden = !d.ingMacros; drawIngs(); drawMacroMode(); };
  const ingMode = h('div', { class: 'ing-mode' }, h('label', { class: 'toggle' },
    h('span', { class: 'switch' }, h('input', { type: 'checkbox', id: 'f-ingmac', checked: d.ingMacros, onchange: (e) => { d.ingMacros = e.target.checked; d.macroMode = d.ingMacros ? 'auto' : 'manual'; syncMacroMode(); } }), h('span')),
    h('span', null, h('b', null, 'Makros je Zutat eintragen'), h('br'), 'An: Makros werden aus den Zutaten berechnet. Aus: nur Zutatenliste, die Makros trägst du unten pro Portion ein.')));
  page.append(h('div', { class: 'form-sec' }, h('span', { class: 'cap' }, 'Zutaten'),
    h('div', { class: 'group' }, ingMode, ingBox,
      h('div', { class: 'grp-actions' },
        h('button', { class: 'btn', id: 'btn-add-ing', onclick: () => { d.ingredients.push(newIng()); drawIngs(); const rows = ingBox.querySelectorAll('.c-name'); rows[rows.length - 1].focus(); } }, icon('plus'), 'Zutat'),
        h('button', { class: 'btn', id: 'btn-mfp', onclick: () => openMFPImport(d, syncMacroMode) }, icon('import'), 'Aus MyFitnessPal einfügen'),
        h('span', { class: 'spacer', style: { flex: '1' } }),
        scaleWrap)),
    h('span', { class: 'muted', style: { padding: '0 4px', fontSize: '13px' } }, 'Häkchen „opt.“ markiert Zutaten, die gut passen, aber nicht nötig sind. Sie zählen nicht in die Makros, können in der Ansicht aber dazugeschaltet werden.'),
    datalist));

  // Makro-Modus
  const macroBox = h('div', { class: 'group' });
  const volPrev = h('div', { class: 'vol-prev', id: 'vol-prev' });
  function updateVolPreview() {
    const dn = densityOf(d);
    volPrev.replaceChildren(...(dn == null ? [h('span', { class: 'muted' }, 'Die Volumen-Einschätzung erscheint, sobald Kalorien und Mengen in g oder ml da sind.')]
      : [h('span', null, 'Volumen'), volBadge(dn), h('span', { class: 'muted num' }, `${fmt(dn)} kcal pro 100 g`)]));
  }
  function drawMacroMode(onlySum) {
    if (onlySum) { const box = macroBox.querySelector('.auto-sum'); if (box) box.replaceChildren(...autoSumKids(totals(d))); updateVolPreview(); return; }
    macroBox.replaceChildren();
    macroBox.append(h('div', { class: 'mode-switch' }, h('span', { class: 'muted' }, d.ingMacros ? 'Berechnet aus den Zutaten (ohne optionale), pro Portion' : 'Eigene Werte pro Portion, z. B. aus MyFitnessPal')));
    if (d.ingMacros) macroBox.append(h('div', { class: 'auto-sum num' }, autoSumKids(totals(d))));
    else macroBox.append(h('div', { class: 'manual-grid' }, [['kcal', 'kcal'], ['carbs', '🍞 KH (g)'], ['fat', '🥑 Fett (g)'], ['protein', '💪 Protein (g)']].map(([k, l]) =>
      h('label', null, l, h('input', { class: 'field', id: 'man-' + k, inputmode: 'decimal', value: d.manual[k], oninput: (e) => { d.manual[k] = e.target.value; updateVolPreview(); } })))));
    macroBox.append(h('div', { class: 'row', style: { borderTop: '1px solid var(--line)' } }, h('label', { for: 'f-weight' }, 'Fertiggewicht'),
      h('input', { id: 'f-weight', inputmode: 'decimal', value: d.weight, placeholder: 'optional in g, sonst Summe der Zutaten in g/ml', oninput: (e) => { d.weight = e.target.value; updateVolPreview(); } })));
    macroBox.append(volPrev);
    updateVolPreview();
  }
  const autoSumKids = (T) => [['kcal', 'kcal', 0], ['carbs', 'g KH', 1], ['fat', 'g Fett', 1], ['protein', 'g Protein', 1]].map(([k, l, dd]) => h('div', null, h('b', null, fmt(T.portion[k], dd)), h('small', null, `${l} pro Portion`)));
  page.append(h('div', { class: 'form-sec' }, h('span', { class: 'cap' }, 'Makros & Volumen'), macroBox,
    h('span', { class: 'muted', style: { padding: '0 4px', fontSize: '13px' } }, 'Fertiggewicht lohnt sich bei Reis, Nudeln oder Ofengerichten, die beim Kochen Wasser aufnehmen oder verlieren.')));
  drawMacroMode();
  drawIngs();

  // Zubereitung (vor Gewürzen gerendert, Gewürze verweisen auf Schritte)
  const stepBox = h('div');
  const drawSteps = () => {
    stepBox.replaceChildren();
    d.steps.forEach((s, idx) => {
      const ta = h('textarea', { class: 'field', rows: '2', placeholder: idx === 0 ? 'z. B. Haferflocken fein mahlen und mit Eiklar verrühren.' : 'Nächster Schritt …', value: s, 'aria-label': `Schritt ${idx + 1}`,
        oninput: (e) => { d.steps[idx] = e.target.value; autoGrow(e.target); },
        onkeydown: (e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); d.steps.splice(idx + 1, 0, ''); drawSteps(); drawSpices(); stepBox.querySelectorAll('textarea')[idx + 1].focus(); } } });
      stepBox.append(h('div', { class: 'step-edit' }, h('div', { class: 'n' }, idx + 1), ta,
        h('div', { class: 'row-btns' },
          h('button', { class: 'mini', 'aria-label': 'Schritt nach oben', disabled: idx === 0, onclick: () => { move(d.steps, idx, -1); drawSteps(); } }, icon('up')),
          h('button', { class: 'mini', 'aria-label': 'Schritt nach unten', disabled: idx === d.steps.length - 1, onclick: () => { move(d.steps, idx, 1); drawSteps(); } }, icon('down')),
          h('button', { class: 'mini del', 'aria-label': 'Schritt entfernen', onclick: () => { d.steps.splice(idx, 1); drawSteps(); drawSpices(); } }, icon('trash')))));
      requestAnimationFrame(() => autoGrow(ta));
    });
  };

  // Gewürze
  const spiceBox = h('div');
  const drawSpices = () => {
    spiceBox.replaceChildren();
    if (!d.spiceGroups.length) spiceBox.append(h('div', { class: 'spice-edit' }, h('span', { class: 'muted' }, 'Lege Gruppen an, z. B. „Teig“ und „Topping“, und wähle die passenden Gewürze aus.')));
    d.spiceGroups.forEach((g, gi) => {
      const rows = h('div', { class: 'spice-rows' });
      const drawRows = () => {
        rows.replaceChildren();
        g.spices.forEach((s, si) => rows.append(h('div', { class: 'spice-row' },
          h('input', { class: 'field', value: s.name, list: 'spice-lib', placeholder: 'Gewürz', 'aria-label': 'Gewürz', oninput: (e) => { s.name = e.target.value; drawLib(); } }),
          h('input', { class: 'field', value: s.amount, placeholder: 'Menge, z. B. 1 TL', 'aria-label': 'Menge Gewürz', oninput: (e) => { s.amount = e.target.value; } }),
          h('button', { class: 'mini del', 'aria-label': 'Gewürz entfernen', onclick: () => { g.spices.splice(si, 1); drawRows(); drawLib(); } }, icon('x')))));
      };
      const lib = h('div', { class: 'lib' });
      const drawLib = () => {
        lib.replaceChildren();
        const used = new Set(g.spices.map(s => s.name.toLowerCase()));
        const extra = state.recipes.flatMap(r => r.spiceGroups.flatMap(x => x.spices.map(s => s.name))).filter(Boolean);
        [...new Set([...SPICE_LIB, ...extra])].forEach(n => lib.append(h('button', { class: 'chip' + (used.has(n.toLowerCase()) ? ' on' : ''), 'aria-pressed': used.has(n.toLowerCase()) ? 'true' : 'false',
          onclick: () => { const i = g.spices.findIndex(s => s.name.toLowerCase() === n.toLowerCase()); if (i >= 0) g.spices.splice(i, 1); else g.spices.push({ name: n, amount: '' }); drawRows(); drawLib(); } }, n)));
      };
      drawRows(); drawLib();
      const stepOpts = [h('option', { value: '' }, 'Kein bestimmter Schritt')].concat(d.steps.map((s, i) => h('option', { value: String(i + 1), selected: String(g.step) === String(i + 1) }, `Schritt ${i + 1}${s.trim() ? ': ' + s.trim().slice(0, 28) + (s.trim().length > 28 ? '…' : '') : ''}`)));
      spiceBox.append(h('div', { class: 'spice-edit' },
        h('div', { class: 'spice-edit-head' },
          h('input', { class: 'field', style: { fontWeight: '600' }, value: g.name, placeholder: 'Gruppe, z. B. Teig', 'aria-label': 'Name der Gewürzgruppe', oninput: (e) => { g.name = e.target.value; } }),
          h('select', { class: 'field', 'aria-label': 'Zugehöriger Schritt', 'data-gi': gi, onchange: (e) => { g.step = e.target.value; } }, stepOpts),
          h('button', { class: 'mini del', 'aria-label': 'Gruppe entfernen', onclick: () => { d.spiceGroups.splice(gi, 1); drawSpices(); } }, icon('trash'))),
        rows,
        h('details', { class: 'libbox', open: g.spices.length === 0 }, h('summary', null, 'Gewürze auswählen'), lib),
        h('button', { class: 'link-btn', style: { alignSelf: 'flex-start' }, onclick: () => { g.spices.push({ name: '', amount: '' }); drawRows(); rows.querySelectorAll('input')[rows.querySelectorAll('input').length - 2].focus(); } }, '+ Eigenes Gewürz')));
    });
  };
  // Nur die Schritt-Auswahl der Gewürzgruppen aktualisieren, ohne das Layout neu aufzubauen
  const resync = () => {
    spiceBox.querySelectorAll('select[data-gi]').forEach(sel => {
      const g = d.spiceGroups[+sel.dataset.gi]; if (!g) return;
      sel.replaceChildren(h('option', { value: '' }, 'Kein bestimmter Schritt'), ...d.steps.map((st, i) => h('option', { value: String(i + 1), selected: String(g.step) === String(i + 1) }, `Schritt ${i + 1}${st.trim() ? ': ' + st.trim().slice(0, 28) + (st.trim().length > 28 ? '…' : '') : ''}`)));
    });
  };
  drawSteps(); drawSpices();
  page.append(h('div', { class: 'form-sec' }, h('span', { class: 'cap' }, 'Gewürze nach Zubereitungsschritt'),
    h('div', { class: 'group' }, spiceBox,
      h('div', { class: 'grp-actions' }, h('button', { class: 'btn', id: 'btn-add-sg', onclick: () => { d.spiceGroups.push({ id: uid(), name: d.spiceGroups.length ? '' : 'Teig', step: '', spices: [] }); drawSpices(); } }, icon('plus'), 'Gewürzgruppe'))),
    h('datalist', { id: 'spice-lib' }, SPICE_LIB.map(n => h('option', { value: n })))));
  page.append(h('div', { class: 'form-sec' }, h('span', { class: 'cap' }, 'Zubereitung'),
    h('div', { class: 'group' }, stepBox,
      h('div', { class: 'grp-actions' }, h('button', { class: 'btn', id: 'btn-add-step', onclick: () => { d.steps.push(''); drawSteps(); resync(); const t = stepBox.querySelectorAll('textarea'); t[t.length - 1].focus(); } }, icon('plus'), 'Schritt')))));
  stepBox.addEventListener('focusout', resync);

  // Verknüpfungen
  const others = state.recipes.filter(r => r.id !== d.id);
  const linkBox = h('div', { class: 'link-pick' });
  if (!others.length) linkBox.append(h('div', { class: 'spice-edit' }, h('span', { class: 'muted' }, 'Sobald du weitere Rezepte hast, kannst du sie hier verbinden.')));
  others.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'de')).forEach(o => linkBox.append(h('label', { class: 'link-opt' },
    h('input', { type: 'checkbox', class: 'check square', checked: d.links.includes(o.id), 'data-link': o.id, onchange: (e) => { d.links = e.target.checked ? [...d.links, o.id] : d.links.filter(x => x !== o.id); } }),
    thumb(o), h('span', null, o.title || 'Ohne Titel'))));
  page.append(h('div', { class: 'form-sec' }, h('span', { class: 'cap' }, 'Verknüpfte Rezepte'), h('div', { class: 'group' }, linkBox),
    h('span', { class: 'muted', style: { padding: '0 4px', fontSize: '13px' } }, 'Verknüpfungen gelten in beide Richtungen.')));

  // Warnhinweise
  const warnBox = h('div', { class: 'tag-pick' });
  const drawWarn = () => {
    warnBox.replaceChildren(
      h('div', { class: 'fp-chips' }, WARN_OPTIONS.map(o => h('button', { class: 'chip' + (d.warnings.includes(o.k) ? ' on' : ''), 'data-warn': o.k, 'aria-pressed': d.warnings.includes(o.k) ? 'true' : 'false',
        onclick: () => { d.warnings = d.warnings.includes(o.k) ? d.warnings.filter(x => x !== o.k) : [...d.warnings, o.k]; drawWarn(); } }, `${o.emoji} ${o.label}`))),
      h('textarea', { class: 'field', id: 'f-warn', rows: '2', placeholder: 'Eigene Hinweise, einer pro Zeile, z. B. „Am Vortag vorbereiten“', value: d.warnText, oninput: (e) => { d.warnText = e.target.value; } }),
      h('span', { class: 'muted', style: { fontSize: '13px' } }, `Automatisch ergänzt: ⏳ ab ${WARN_LIMITS.time} Min. Gesamtdauer · 🔥 ab ${WARN_LIMITS.density} kcal pro 100 g · ⚖️ ab ${WARN_LIMITS.portion} kcal pro Portion.`));
  };
  drawWarn();
  page.append(h('div', { class: 'form-sec' }, h('span', { class: 'cap' }, 'Warnhinweise'), h('div', { class: 'group' }, warnBox)));

  // Sonstiges
  page.append(h('div', { class: 'form-sec' }, h('label', { class: 'cap', for: 'f-notes' }, 'Sonstiges'),
    h('div', { class: 'group' }, h('div', { class: 'row' }, h('textarea', { id: 'f-notes', placeholder: 'Tipps, Varianten, Aufbewahrung, Meal-Prep-Hinweise …', value: d.notes, oninput: (e) => { d.notes = e.target.value; } })))));

  wrap.append(page);
  if (isNew) requestAnimationFrame(() => $('#f-title') && $('#f-title').focus());
  return wrap;
}
let onImagePicked = null;
$('#file-img').addEventListener('change', (e) => { const f = e.target.files[0]; e.target.value = ''; if (f && onImagePicked && state.draft) onImagePicked(f); });
function move(arr, i, dir) { const j = i + dir; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; }
function autoGrow(t) { t.style.height = 'auto'; t.style.height = Math.max(54, t.scrollHeight + 2) + 'px'; }

function resizeImage(file, max = 1200, q = 0.8) {
  return new Promise((res) => {
    const fr = new FileReader();
    fr.onload = () => {
      const im = new Image();
      im.onload = () => {
        const s = Math.min(1, max / Math.max(im.width, im.height));
        const c = document.createElement('canvas'); c.width = Math.round(im.width * s); c.height = Math.round(im.height * s);
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
        res(c.toDataURL('image/jpeg', Store.mode === 'ls' ? 0.72 : q));
      };
      im.onerror = () => { toast('Bild konnte nicht gelesen werden.'); res(''); };
      im.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}

/* ---------- MyFitnessPal-Import ---------- */
const MFP_ORDERS = {
  'kcal,carbs,fat,protein': 'kcal · KH · Fett · Protein (MFP Standard)',
  'kcal,protein,carbs,fat': 'kcal · Protein · KH · Fett',
  'kcal,fat,carbs,protein': 'kcal · Fett · KH · Protein',
};
const SKIP_RE = /^(gesamt|total|totals|summe|tagesziel|tagesziele|ziel|goal|verbleibend|remaining|deine tägliche|your daily|frühstück|mittagessen|abendessen|snacks?|breakfast|lunch|dinner|lebensmittel hinzufügen|add food|schnellhilfe|quick tools|nährwertangaben|nutrition|zutaten|ingredients|kalorien|calories|kohlenhydrate|carbs)\b/i;
const UNIT_RE = /(?:,\s*|\s+|^)(\d+(?:[.,]\d+)?|\d+\/\d+)\s*(g|gramm|grams?|ml|kg|l|liter|el|tl|esslöffel|teelöffel|stück|stk\.?|scheiben?|portion(?:en)?|serving|servings|tasse(?:n)?|cups?|tbsp|tsp|oz|pieces?|medium|large|small|container|packung(?:en)?|prise)\b\.?$/i;
const HEADER_RE = /^(name|zutat|zutaten|lebensmittel|food|menge|amount|einheit|kcal|kalorien|calories|kh|kohlenhydrate|carbs|fett|fat|protein|eiweiß|natrium|sodium|zucker|sugar|ballaststoffe|fiber)$/i;
function splitAmount(nameRaw) {
  let name = nameRaw.trim().replace(/\s+/g, ' ');
  const m = name.match(UNIT_RE);
  if (!m) return { name, amount: '', unit: '' };
  let unit = m[2].toLowerCase();
  const map = { gramm: 'g', gram: 'g', grams: 'g', liter: 'l', el: 'EL', esslöffel: 'EL', tbsp: 'EL', tl: 'TL', teelöffel: 'TL', tsp: 'TL', stück: 'Stück', 'stk': 'Stück', 'stk.': 'Stück', piece: 'Stück', pieces: 'Stück', medium: 'Stück', large: 'Stück', small: 'Stück', scheibe: 'Scheibe', scheiben: 'Scheibe', portion: 'Portion', portionen: 'Portion', serving: 'Portion', servings: 'Portion', prise: 'Prise', packung: 'Packung', packungen: 'Packung' };
  unit = map[unit] || unit;
  let amount = m[1].includes('/') ? (m[1].split('/')[0] / m[1].split('/')[1]) : parseNum(m[1]);
  name = name.slice(0, m.index).replace(/[,\-–\s]+$/, '').trim();
  return { name: name || nameRaw.trim(), amount, unit };
}
function isNumericCell(c) { return /^-?[\d.,]+\s*(kcal|cal|g|mg)?$/i.test(c.trim()) && /\d/.test(c); }
function parseMFP(text, order = 'kcal,carbs,fat,protein') {
  const keys = order.split(',');
  const items = []; let cur = null;
  const lines = text.replace(/\r/g, '').split('\n');
  for (let raw of lines) {
    let line = raw.replace(/ /g, ' ').trim();
    if (!line) continue;
    line = line.replace(/\b(löschen|entfernen|delete|remove|bearbeiten|edit)\b/gi, '').trim();
    if (!line) continue;
    let cells = line.split(/\t|;|\|/).map(c => c.trim()).filter(Boolean);
    if (cells.length === 1) {
      // Zahlen am Zeilenende abtrennen: "Magerquark, 250 g 168 30 0,5 30"
      const m = line.match(/^(.*?[^\d\s.,])\s+((?:-?\d[\d.,]*\s*(?:kcal|cal)?\s*){1,8})$/i);
      if (m && !UNIT_RE.test(line)) cells = [m[1], ...m[2].trim().split(/\s+/).filter(x => /\d/.test(x))];
      else if (m && UNIT_RE.test(line)) {
        // Name endet auf Einheit, z.B. "Haferflocken 50 g" → keine Makros
        cells = [line];
      }
    }
    const textCells = cells.filter(c => !isNumericCell(c));
    const nums = cells.filter(isNumericCell).map(parseNum);
    const nameTxt = textCells.join(', ').trim();
    if (nameTxt && SKIP_RE.test(nameTxt)) { cur = null; continue; }
    if (!nums.length && textCells.length > 1 && textCells.every(c => HEADER_RE.test(c))) continue;
    if (nameTxt) {
      cur = { ...splitAmount(nameTxt), nums: [...nums] };
      items.push(cur);
    } else if (cur) {
      cur.nums.push(...nums);
    }
  }
  return items.map(it => {
    const o = { name: it.name, amount: it.amount, unit: it.unit || 'g', kcal: '', carbs: '', fat: '', protein: '' };
    keys.forEach((k, i) => { if (it.nums[i] != null) o[k] = Math.round(it.nums[i] * 10) / 10; });
    return o;
  }).filter(o => o.name);
}
function openMFPImport(d, done) {
  let order = Settings.get('mfpOrder', 'kcal,carbs,fat,protein');
  const ta = h('textarea', { class: 'field', id: 'mfp-text', rows: '7', style: { fontFamily: 'var(--mono)', fontSize: '13px' },
    placeholder: 'Haferflocken, 50 g\t186\t29\t4\t7\nWhey Vanille, 30 g\t117\t2\t2\t23\nEiklar, 100 ml\t49\t1\t0\t11', oninput: () => drawPrev() });
  const prev = h('div');
  let parsed = [];
  const drawPrev = () => {
    parsed = parseMFP(ta.value, order);
    prev.replaceChildren();
    if (!ta.value.trim()) return;
    if (!parsed.length) { prev.append(h('p', null, 'Keine Zutaten erkannt. Prüfe, ob jede Zutat in einer eigenen Zeile steht.')); return; }
    const sel = parsed.map(() => true); parsed._sel = sel;
    prev.append(h('div', { class: 'preview-wrap' }, h('table', { class: 'preview' },
      h('thead', null, h('tr', null, h('th', null, ''), h('th', null, 'Zutat'), h('th', { class: 'r' }, 'Menge'), h('th', { class: 'r' }, 'kcal'), h('th', { class: 'r' }, 'KH'), h('th', { class: 'r' }, 'Fett'), h('th', { class: 'r' }, 'Prot.'))),
      h('tbody', null, parsed.map((p, i) => h('tr', null,
        h('td', null, h('input', { type: 'checkbox', class: 'check square', checked: true, 'aria-label': 'Übernehmen', onchange: (e) => { sel[i] = e.target.checked; } })),
        h('td', null, p.name), h('td', { class: 'r' }, p.amount ? `${fmt(p.amount, 1)} ${p.unit}` : '–'),
        h('td', { class: 'r' }, p.kcal === '' ? '–' : fmt(p.kcal, 1)), h('td', { class: 'r' }, p.carbs === '' ? '–' : fmt(p.carbs, 1)),
        h('td', { class: 'r' }, p.fat === '' ? '–' : fmt(p.fat, 1)), h('td', { class: 'r' }, p.protein === '' ? '–' : fmt(p.protein, 1))))))));
    const s = parsed.reduce((a, p) => mapM(a, (v) => v), { kcal: 0, carbs: 0, fat: 0, protein: 0 });
    parsed.forEach(p => { s.kcal += parseNum(p.kcal); s.carbs += parseNum(p.carbs); s.fat += parseNum(p.fat); s.protein += parseNum(p.protein); });
    prev.append(h('p', { class: 'num' }, `${parsed.length} Zutaten erkannt · zusammen ${fmt(s.kcal)} kcal, ${fmt(s.carbs, 1)} g KH, ${fmt(s.fat, 1)} g Fett, ${fmt(s.protein, 1)} g Protein.`));
  };
  openDialog('Aus MyFitnessPal einfügen', [
    h('p', null, 'MyFitnessPal bietet keine offene Schnittstelle, deshalb läuft der Import über Kopieren und Einfügen:'),
    h('ol', null,
      h('li', null, 'In MyFitnessPal im Browser dein Rezept oder den Tagebuch-Eintrag öffnen.'),
      h('li', null, 'Die Zeilen mit den Zutaten markieren und kopieren.'),
      h('li', null, 'Hier einfügen. Die Vorschau zeigt, was erkannt wurde.')),
    ta,
    h('div', { class: 'inline-opts' },
      h('label', null, 'Spaltenreihenfolge ', h('select', { id: 'mfp-order', onchange: (e) => { order = e.target.value; Settings.set('mfpOrder', order); drawPrev(); } },
        Object.entries(MFP_ORDERS).map(([k, l]) => h('option', { value: k, selected: k === order }, l)))),
      h('span', null, 'Zahlen mit Komma oder Punkt, getrennt durch Tab, Semikolon oder Leerzeichen.')),
    prev,
  ], [
    h('button', { class: 'btn', onclick: () => $('#dlg').close() }, 'Abbrechen'),
    h('button', { class: 'btn primary', id: 'mfp-apply', onclick: () => {
      const take = parsed.filter((p, i) => !parsed._sel || parsed._sel[i]);
      if (!take.length) { toast('Nichts zum Übernehmen.'); return; }
      d.ingredients = d.ingredients.filter(i => i.name.trim() || parseNum(i.kcal));
      take.forEach(p => d.ingredients.push(newIng({ ...p, amount: p.amount === '' ? '' : p.amount })));
      if (!d.ingMacros && take.some(p => p.kcal !== '')) { d.ingMacros = true; d.macroMode = 'auto'; }
      $('#dlg').close(); done(); toast(`${take.length} Zutaten übernommen`);
    } }, 'Zutaten übernehmen'),
  ]);
  setTimeout(() => ta.focus(), 50);
}

/* ---------- PDF / Druck ---------- */
function printRecipe(r) {
  const root = $('#print-root');
  const T = totals(r);
  const steps = r.steps.filter(s => s.trim());
  const ings = [...r.ingredients.filter(i => !i.optional), ...r.ingredients.filter(i => i.optional)].filter(i => i.name);
  const rel = r.links.map(byId).filter(Boolean);
  const groups = r.spiceGroups.filter(g => g.spices.some(s => s.name));
  const tm = timesOf(r); const dn = densityOf(r); const ws = warnings(r);
  root.replaceChildren(...[
    r.image ? h('img', { class: 'pr-hero', src: r.image, alt: '' }) : null,
    h('div', { class: 'pr-kicker' }, 'Eriks Rezepte · Winter Arc'),
    h('h1', { class: 'pr-title' }, r.title || 'Ohne Titel'),
    r.subtitle ? h('p', { class: 'pr-sub' }, r.subtitle) : null,
    h('div', { class: 'pr-meta' }, h('span', null, `🍽️ ${fmt(T.servings)} ${T.servings === 1 ? 'Portion' : 'Portionen'}`),
      tm.prep ? h('span', null, `🔪 Vorbereitung ${fmtMin(tm.prep)}`) : null, tm.cook ? h('span', null, `🍳 Kochzeit ${fmtMin(tm.cook)}`) : null, tm.total ? h('span', null, `⏱️ Gesamt ${fmtMin(tm.total)}`) : null,
      r.source ? h('span', null, 'Quelle: ' + r.source) : null),
    r.tags.length ? h('div', { class: 'pr-tags' }, r.tags.map(t => h('span', null, tagLabel(t)))) : h('div', { style: { height: '4mm' } }),
    h('div', { class: 'pr-macros' },
      h('div', null, h('b', null, `${fmt(T.portion.kcal)} kcal`), h('small', null, `pro Portion · gesamt ${fmt(T.total.kcal)}`)),
      MACROS.map(m => h('div', null, h('b', null, `${fmt(T.portion[m.k], 1)} g`), h('small', null, `${m.label} · gesamt ${fmt(T.total[m.k], 1)} g`)))),
    dn != null ? h('div', { class: 'pr-vol' }, h('b', null, 'Volumen: '), `${volLevel(dn).emoji} ${volLevel(dn).label} · ${fmt(dn)} kcal pro 100 g`) : null,
    ws.length ? h('div', { class: 'pr-warn' }, ws.map(w => h('div', null, `${w.emoji} ${w.text}`))) : null,
    h('div', { class: 'pr-cols' },
      h('div', null, h('h2', { class: 'pr-h' }, 'Zutaten'),
        h('ul', { class: 'pr-ing' }, ings.map(i => h('li', null, h('span', null, i.name, i.optional ? h('span', { class: 'pr-opt' }, 'optional') : null), h('span', null, fmtAmt(i.amount, i.unit)))))),
      h('div', null, h('h2', { class: 'pr-h' }, 'Gewürze'),
        groups.length ? groups.map(g => h('div', { class: 'pr-sg' }, h('b', null, (g.name || 'Gewürze') + (parseInt(g.step, 10) ? ` · Schritt ${parseInt(g.step, 10)}` : '')),
          h('div', null, g.spices.filter(s => s.name).map(s => s.name + (s.amount ? ` (${s.amount})` : '')).join(', ')))) : h('p', { style: { color: '#6e6e73', margin: 0 } }, '–'))),
    steps.length ? h('div', null, h('h2', { class: 'pr-h' }, 'Zubereitung'), h('ol', { class: 'pr-steps' }, steps.map(s => h('li', null, h('span', null, s))))) : null,
    r.notes.trim() ? h('div', { class: 'pr-block' }, h('h2', { class: 'pr-h' }, 'Sonstiges'), h('p', null, r.notes)) : null,
    rel.length ? h('div', { class: 'pr-block' }, h('h2', { class: 'pr-h' }, 'Passt dazu'), h('p', null, rel.map(o => o.title).join(' · '))) : null,
    h('div', { class: 'pr-foot' }, h('span', null, 'Eriks Rezepte'), h('span', null, new Date().toLocaleDateString('de-DE')))].filter(Boolean));
  const oldTitle = document.title;
  document.title = (r.title || 'Rezept').replace(/[\\/:*?"<>|]/g, '');
  const finish = () => { document.title = oldTitle; window.removeEventListener('afterprint', finish); };
  window.addEventListener('afterprint', finish);
  const imgEl = root.querySelector('img');
  const go2 = () => setTimeout(() => window.print(), 60);
  if (imgEl && !imgEl.complete) imgEl.onload = go2; else go2();
}

/* =========================================================
   Tab-Leiste
   ========================================================= */
const TABS = [['rezepte', 'Rezepte', 'book'], ['woche', 'Woche', 'calendar'], ['vorrat', 'Vorrat', 'jar'], ['einkauf', 'Einkauf', 'cart']];
function renderTabbar(tab) {
  const open = state.shop.filter(i => !i.done).length;
  const mk = ([k, l, ic]) => h('button', {
    class: 'tab' + (tab === k ? ' on' : ''), id: 'tab-' + k, 'aria-current': tab === k ? 'page' : null,
    onclick: () => {
      if (k !== 'rezepte') return go(k);
      if (state.lastRecipeHash) return go(state.lastRecipeHash.slice(1));
      const first = filteredRecipes()[0];
      go(first && matchMedia('(min-width: 821px)').matches ? 'r-' + first.id : '');
    },
  }, icon(ic), h('span', null, l), k === 'einkauf' && open ? h('span', { class: 'tbadge' }, open) : null);
  $('#tabbar').replaceChildren(mk(TABS[0]), mk(TABS[1]),
    h('button', { class: 'tab-new', id: 'btn-new', title: 'Neues Rezept', 'aria-label': 'Neues Rezept', onclick: () => { state.draft = null; go('neu'); } }, icon('plus')),
    mk(TABS[2]), mk(TABS[3]));
}
function rerenderTab(focusId) {
  const tp = $('#tabpage'); const st = tp.scrollTop;
  render();
  tp.scrollTop = st;
  if (focusId) { const el = document.getElementById(focusId); if (el) el.focus(); }
}

/* =========================================================
   Wochenplan
   ========================================================= */
const SHIFTS = [{ k: 'frueh', label: 'Frühdienst' }, { k: 'tag', label: 'Tagesdienst' }, { k: 'spaet', label: 'Spätdienst' }, { k: 'nacht', label: 'Nachtdienst' }, { k: 'fruehnacht', label: 'Früh/Nachtdienst' }];
const DEFAULT_MEALS = ['Frühstück', 'Mittagessen', 'Abendessen'];
const irregularWork = () => Settings.get('irregular', true);
const duties = () => { const l = Settings.get('duties', null); return Array.isArray(l) ? l : SHIFTS; };
const workOptions = () => irregularWork() ? duties() : [{ k: 'arbeit', label: 'Arbeitstag' }];
const isWorkDay = (d) => !!(d && d.shift && d.shift !== 'frei');
function shiftLabel(d) {
  if (!d || !d.shift) return '';
  if (d.shift === 'frei') return 'Freier Tag';
  const o = [...duties(), ...SHIFTS, { k: 'arbeit', label: 'Arbeitstag' }].find(x => x.k === d.shift);
  return o ? o.label : (d.shiftLabel || 'Arbeit');
}
const MEAL_TYPES = { 'Frühstück': '🥣', 'Mittagessen': '🍽️', 'Abendessen': '🍲', 'Snack': '🍎', 'Shake': '🥤', 'Dessert': '🍰', 'Pre-Workout': '⚡' };
const EXTRA_TYPES = ['Abendessen', 'Snack', 'Shake', 'Dessert', 'Pre-Workout'];
const MAX_MEALS = 5;
const SPORT_QUICK = ['Kraft', 'Cardio', 'Mobility', 'Ruhetag'];
const WD = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const dkey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const fmtDM = (d) => d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
function weekStartDate(offset = 0) {
  const ws = 1; // Woche beginnt immer am Montag
  const t = new Date(); t.setHours(12, 0, 0, 0);
  return addDays(t, -((t.getDay() - ws + 7) % 7) + offset * 7);
}
function dayData(key) {
  if (!state.plan.days[key]) state.plan.days[key] = { shift: '', place: '', events: [], meals: DEFAULT_MEALS.map(type => ({ id: uid(), type })), sport: '', mv: 3 };
  const d = state.plan.days[key];
  d.events = d.events || []; d.meals = d.meals || [];
  while (d.meals.length < 2) d.meals.push({ id: uid(), type: d.meals.length ? 'Mittagessen' : 'Frühstück' });
  if (d.mv !== 3) {
    if (d.mv === 2) {
      // Snack ist keine Standardmahlzeit mehr: automatisch angelegte, leere Snacks entfernen
      d.meals = d.meals.filter((m, i) => i < 2 || !(m.type === 'Snack' && !m.recipeId && !m.text));
    } else {
      // Umstellung älterer Tage: Abendessen vorbelegen, „Frei“ wird zum eigenen Eintrag
      if (d.meals.length < MAX_MEALS && !d.meals.some(m => m.type === 'Abendessen')) d.meals.push({ id: uid(), type: 'Abendessen' });
      if (d.shift === 'frei') { d.shift = ''; d.place = d.place || 'Frei'; }
    }
    d.mv = 3;
  }
  d.place = d.place || '';
  return d;
}
function dayTotals(d) {
  const t = { kcal: 0, carbs: 0, fat: 0, protein: 0 }; let rec = 0, free = 0;
  for (const m of d.meals) {
    const r = m.recipeId && byId(m.recipeId);
    if (r) { const p = totals(r).portion; const f = parseNum(m.portions) || 1; for (const k in t) t[k] += p[k] * f; rec++; }
    else if (m.text) free++;
  }
  return { t, rec, free };
}
const tile = (v, l) => h('div', { class: 'sum-tile' }, h('b', null, v), h('small', null, l));

function weekPage() {
  const start = weekStartDate(state.weekOffset);
  const days = [...Array(7)].map((_, i) => addDays(start, i));
  const end = days[6];
  const datas = days.map(d => dayData(dkey(d)));
  const withRec = datas.map(dayTotals).filter(x => x.rec);
  const avg = (k) => withRec.reduce((a, x) => a + x.t[k], 0) / withRec.length;
  const sportDays = datas.filter(d => d.sport && !/ruhetag|kein/i.test(d.sport)).length;
  const label = state.weekOffset === 0 ? 'Diese Woche' : state.weekOffset === 1 ? 'Nächste Woche' : state.weekOffset === -1 ? 'Letzte Woche' : '';
  const wrap = h('div', { class: 'tp' });
  wrap.append(h('div', { class: 'tp-head' },
    h('div', null, h('h1', null, 'Wochenplanung'),
      h('div', { class: 'sub num', id: 'wk-range' }, `${label ? label + ' · ' : ''}${WD[start.getDay()].slice(0, 2)} ${fmtDM(start)} – ${WD[end.getDay()].slice(0, 2)} ${fmtDM(end)} ${end.getFullYear()}`)),
    h('div', { class: 'tp-actions' },
      h('div', { class: 'week-nav' },
        h('button', { class: 'icon-btn', id: 'wk-prev', 'aria-label': 'Vorherige Woche', onclick: () => { state.weekOffset--; state.dayKey = null; rerenderTab(); } }, icon('back')),
        h('button', { class: 'btn', id: 'wk-today', disabled: state.weekOffset === 0 && (!state.dayKey || state.dayKey === dkey(new Date())), onclick: () => { state.weekOffset = 0; state.dayKey = null; rerenderTab(); } }, 'Heute'),
        h('button', { class: 'icon-btn', id: 'wk-next', 'aria-label': 'Nächste Woche', onclick: () => { state.weekOffset++; state.dayKey = null; rerenderTab(); } }, icon('next'))))));

  const todayIdx = days.findIndex(x => dkey(x) === dkey(new Date()));
  let idx = days.findIndex(x => dkey(x) === state.dayKey);
  if (idx < 0) idx = todayIdx >= 0 ? todayIdx : 0;
  const strip = h('div', { class: 'day-strip', role: 'tablist', 'aria-label': 'Tag wählen' }, days.map((x, i) => {
    const dd = datas[i];
    const kind = isWorkDay(dd) ? ' work' : dd.shift === 'frei' ? ' free' : '';
    return h('button', { class: 'ds' + kind + (i === idx ? ' on' : '') + (i === todayIdx ? ' is-today' : ''), role: 'tab', 'data-ds': i, 'aria-label': WD[x.getDay()] + ' ' + fmtDM(x) + (dd.shift ? ', ' + shiftLabel(dd) : ''),
      onclick: () => { const c = daysEl.children[i]; daysEl.scrollTo({ left: c.offsetLeft - daysEl.firstElementChild.offsetLeft, behavior: 'smooth' }); mark(i); } },
      h('small', null, WD[x.getDay()].slice(0, 2)), h('b', { class: 'num' }, String(x.getDate())),
      h('i', { class: 'ds-dot' + (isWorkDay(dd) ? ' s-work' : dd.shift === 'frei' ? ' s-free' : dd.place ? ' s-ort' : '') }));
  }));
  const daysEl = h('div', { class: 'days', id: 'days' }, days.map(dayCard));
  const mark = (i) => { state.dayKey = dkey(days[i]); strip.querySelectorAll('.ds').forEach((b, j) => b.classList.toggle('on', j === i)); };
  let raf = 0;
  daysEl.addEventListener('scroll', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => {
    const w = daysEl.firstElementChild.getBoundingClientRect().width + 12;
    if (daysEl.scrollWidth > daysEl.clientWidth + 4) mark(Math.max(0, Math.min(6, Math.round(daysEl.scrollLeft / w))));
  }); }, { passive: true });
  wrap.append(strip, daysEl);
  queueMicrotask(() => { const c = daysEl.children[idx]; if (c && daysEl.scrollWidth > daysEl.clientWidth + 4) daysEl.scrollLeft = c.offsetLeft - daysEl.firstElementChild.offsetLeft; });

  wrap.append(h('button', { class: 'btn primary wk-shop', id: 'wk-shop', onclick: () => shopWeek(datas) }, icon('cart'), 'Woche einkaufen'));
  wrap.append(h('div', { class: 'summary' },
    tile(withRec.length ? fmt(avg('kcal')) + ' kcal' : '–', 'Ø pro Tag (Tage mit Rezepten)'),
    tile(withRec.length ? fmt(avg('protein')) + ' g' : '–', 'Ø Protein pro Tag'),
    tile(String(sportDays), 'Tage mit Sport')));
  return wrap;
}

function dayCard(date) {
  const key = dkey(date); const d = dayData(key);
  const isToday = key === dkey(new Date());
  const save = (focusId) => { persist('plan'); rerenderTab(focusId); };
  const card = h('article', { class: 'day' + (isToday ? ' today' : ''), 'data-day': key });
  card.append(h('div', { class: 'day-head' }, h('h3', null, WD[date.getDay()], isToday ? h('span', { class: 'today-pill' }, 'Heute') : null), h('span', { class: 'dt num' }, fmtDM(date))));

  // Arbeit
  const opts = workOptions();
  const known = !d.shift || d.shift === 'frei' || opts.some(o => o.k === d.shift);
  const work = isWorkDay(d);
  card.append(h('div', { class: 'day-sec', style: { borderTop: '0', paddingTop: '6px' } }, h('div', { class: 'sec-lab' }, 'Arbeit'),
    h('div', { class: 'work-row' },
      h('label', { class: 'work-sel' + (work ? ' on s-work' : d.shift === 'frei' ? ' on s-free' : '') },
        work ? h('span', { class: 'wk-emo', 'aria-hidden': 'true' }, '💼') : d.shift === 'frei' ? h('span', { class: 'wk-emo', 'aria-hidden': 'true' }, '🏖️') : icon('calendar'),
        h('select', { 'data-work': key, 'aria-label': 'Arbeit an diesem Tag', onchange: (e) => {
          const v = e.target.value; d.shift = v;
          d.shiftLabel = v ? (v === 'frei' ? 'Freier Tag' : (opts.find(o => o.k === v) || {}).label || d.shiftLabel || '') : '';
          save();
        } },
          h('option', { value: '', selected: !d.shift }, 'Nichts eingetragen'),
          known ? null : h('option', { value: d.shift, selected: true }, shiftLabel(d)),
          opts.map(o => h('option', { value: o.k, selected: d.shift === o.k }, o.label)),
          h('option', { value: 'frei', selected: d.shift === 'frei' }, 'Freier Tag'))),
      h('label', { class: 'place' + (d.place ? ' on' : '') }, icon('pin'),
        h('input', { value: d.place, id: 'place-' + key, 'data-place': key, placeholder: 'Eigener Eintrag, z. B. Urlaub', 'aria-label': 'Eigener Eintrag', enterkeyhint: 'done',
          onchange: (e) => { d.place = e.target.value.trim(); save(); },
          onkeydown: (e) => { if (e.key === 'Enter') e.target.blur(); } })))));

  // Mahlzeiten
  const ms = h('div', { class: 'day-sec' }, h('div', { class: 'sec-lab' }, 'Mahlzeiten'));
  d.meals.forEach((m, i) => {
    const typeEl = i < DEFAULT_MEALS.length && m.type === DEFAULT_MEALS[i] ? h('span', { class: 'mt' }, m.type)
      : h('label', { class: 'mt mt-pick', title: 'Art ändern' }, h('span', null, m.type), icon('down'),
        h('select', { class: 'mt-sel', 'aria-label': 'Art der Mahlzeit', onchange: (e) => { m.type = e.target.value; save(); } },
          [...new Set([m.type, ...EXTRA_TYPES])].map(t => h('option', { value: t, selected: m.type === t }, t))));
    const r = m.recipeId && byId(m.recipeId);
    const filled = !!(r || m.text);
    const prep = filled && m.prepared ? ' prepped' : '';
    let content;
    if (r) {
      const p = totals(r).portion; const f = parseNum(m.portions) || 1;
      content = h('button', { class: 'meal-rec' + prep, title: 'Rezept öffnen', onclick: () => go('r-' + r.id) }, thumb(r),
        h('div', { style: { minWidth: '0' } }, h('b', null, (r.title || 'Ohne Titel') + (f !== 1 ? ` ×${fmt(f, 2)}` : '')), h('span', { class: 'num' }, `${fmt(p.kcal * f)} kcal · ${fmt(p.protein * f)} g P` + (m.prepared ? ' · vorbereitet' : ''))));
    } else if (m.text) content = h('button', { class: 'meal-txt' + prep, title: 'Ändern', onclick: () => openMealPicker(m) }, m.text);
    else content = h('button', { class: 'meal-pick', onclick: () => openMealPicker(m) }, '+ Rezept oder Notiz');
    ms.append(h('div', { class: 'meal', 'data-meal': i },
      typeEl,
      h('div', { class: 'meal-line' }, content,
        h('div', { class: 'row-btns' },
          filled ? h('button', { class: 'mini', 'aria-label': 'Ändern', onclick: () => openMealPicker(m) }, icon('edit')) : null,
          i >= 2 ? h('button', { class: 'mini del', 'aria-label': 'Mahlzeit entfernen', onclick: () => { d.meals.splice(i, 1); save(); } }, icon('trash'))
            : filled ? h('button', { class: 'mini del', 'aria-label': 'Leeren', onclick: () => { m.recipeId = ''; m.text = ''; m.prepared = false; save(); } }, icon('trash')) : null))));
  });
  if (d.meals.length < MAX_MEALS) ms.append(h('button', { class: 'link-btn', style: { alignSelf: 'flex-start' }, 'data-addmeal': key,
    onclick: () => { d.meals.push({ id: uid(), type: d.meals.length === 2 ? 'Abendessen' : 'Snack' }); save(); } }, '+ Mahlzeit'));
  card.append(ms);

  // Termine
  const ev = h('div', { class: 'day-sec' }, h('div', { class: 'sec-lab' }, 'Termine'));
  [...d.events].sort((a, b) => (a.time || '99').localeCompare(b.time || '99')).forEach(e => ev.append(h('div', { class: 'ev' },
    e.time ? h('span', { class: 'tm' }, e.time) : null, h('span', { style: { flex: '1', minWidth: '0' } }, e.text),
    h('button', { class: 'mini del', 'aria-label': 'Termin entfernen', onclick: () => { d.events = d.events.filter(x => x !== e); save(); } }, icon('trash')))));
  const addBtn = h('button', { class: 'link-btn', style: { alignSelf: 'flex-start' }, 'data-addevent': key, onclick: () => {
    const tIn = h('input', { type: 'time', class: 'field', 'aria-label': 'Uhrzeit' });
    const xIn = h('input', { class: 'field', id: 'ev-' + key, placeholder: 'z. B. Essen mit Freunden', 'aria-label': 'Termin', enterkeyhint: 'done',
      onkeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); addEv(); } if (e.key === 'Escape') rerenderTab(); } });
    const addEv = () => { const t = xIn.value.trim(); if (!t) return; d.events.push({ id: uid(), time: tIn.value, text: t }); save(); };
    addBtn.replaceWith(h('div', { class: 'inline-add' }, tIn, xIn, h('button', { class: 'go-btn', 'aria-label': 'Termin speichern', onclick: addEv }, icon('check'))));
    xIn.focus();
  } }, '+ Termin');
  ev.append(addBtn);
  card.append(ev);

  // Sport
  const sp = h('div', { class: 'day-sec' }, h('div', { class: 'sec-lab' }, 'Sport'),
    h('div', { class: 'sport-row' },
      h('input', { class: 'field', value: d.sport, placeholder: 'z. B. Kraft Push, 10 km Lauf', 'aria-label': 'Sport', 'data-sport': key, enterkeyhint: 'done', onchange: (e) => { d.sport = e.target.value.trim(); save(); } })));
  if (!d.sport) sp.append(h('div', { class: 'mini-chips' }, SPORT_QUICK.map(q => h('button', { class: 'mini-chip', onclick: () => { d.sport = q; save(); } }, q))));
  card.append(sp);

  // Vorbereitet?
  const filledMeals = d.meals.filter(m => (m.recipeId && byId(m.recipeId)) || m.text);
  if (filledMeals.length) {
    const done = filledMeals.filter(m => m.prepared).length;
    card.append(h('div', { class: 'day-sec' },
      h('button', { class: 'prep-btn' + (done === filledMeals.length ? ' all' : done ? ' some' : ''), 'data-prepbtn': key, onclick: () => openPrepDialog(key) },
        h('span', { class: 'prep-ic' }, done ? icon('check') : null),
        h('span', { class: 'prep-t' }, h('b', null, 'Vorbereitet?'), h('small', null, done === filledMeals.length ? 'Alles vorgekocht' : done ? `${done} von ${filledMeals.length} vorgekocht` : 'Noch nichts vorgekocht')),
        icon('next'))));
  }

  const T = dayTotals(d);
  card.append(h('div', { class: 'day-foot num' },
    T.rec ? [h('span', null, h('b', null, fmt(T.t.kcal)), ' kcal'), h('span', null, h('b', null, fmt(T.t.protein)), ' g Protein'), h('span', null, `${fmt(T.t.carbs)} g KH · ${fmt(T.t.fat)} g Fett`)]
      : h('span', null, 'Noch keine Rezepte mit Makros'),
    T.free ? h('span', null, `+ ${T.free} ohne Makros`) : null));
  return card;
}

function openPrepDialog(key) {
  const d = dayData(key); const date = new Date(key + 'T12:00:00');
  const meals = d.meals.filter(m => (m.recipeId && byId(m.recipeId)) || m.text);
  const dlg = $('#dlg');
  openDialog(`Vorbereitet? · ${WD[date.getDay()]}`, h('div', { class: 'prep-list' },
    h('p', { class: 'bk-note' }, 'Hake an, was du schon vorgekocht hast.'),
    meals.map(m => { const r = m.recipeId && byId(m.recipeId);
      return h('label', { class: 'choice' }, h('input', { type: 'checkbox', checked: !!m.prepared, 'data-prepcheck': m.type, onchange: (e) => { m.prepared = e.target.checked; persist('plan'); } }),
        h('div', null, h('b', null, m.type), h('span', null, r ? r.title : m.text))); })),
    [h('button', { class: 'btn primary', id: 'prep-done', onclick: () => dlg.close() }, 'Fertig')]);
  dlg.addEventListener('close', () => { if (tabOf(route()) === 'woche') rerenderTab(); renderReminder(); }, { once: true });
}

/* ---------- Einstellungen ---------- */
function openSettings() {
  let irregular = irregularWork();
  const list = duties().map(x => ({ k: x.k, label: x.label }));
  const body = h('div', { id: 'settings', style: { display: 'flex', flexDirection: 'column', gap: '16px' } });
  const addDuty = () => { const inp = $('#duty-new'); const v = inp && inp.value.trim(); if (!v) return; list.push({ k: 'c' + uid(), label: v }); draw(); $('#duty-new').focus(); };
  const draw = () => body.replaceChildren(
    h('section', { class: 'bk' }, h('h4', null, 'Arbeit'),
      h('label', { class: 'choice' }, h('input', { type: 'checkbox', id: 'set-irregular', checked: irregular, onchange: (e) => { irregular = e.target.checked; draw(); } }),
        h('div', null, h('b', null, 'Unregelmäßige Arbeitszeiten'),
          h('span', null, irregular ? 'Lege deine Dienste selbst fest. Sie stehen in der Wochenplanung unter „Arbeit“ zur Auswahl.' : 'In der Wochenplanung wählst du zwischen „Arbeitstag“ und „Freier Tag“.'))),
      irregular ? h('div', { class: 'duty-list' },
        h('div', { class: 'sec-lab' }, 'Deine Dienste'),
        list.map((x, i) => h('div', { class: 'duty-row' },
          h('input', { class: 'field', value: x.label, 'data-duty': i, 'aria-label': 'Dienst', oninput: (e) => { x.label = e.target.value; } }),
          h('button', { class: 'mini del', 'aria-label': `${x.label} entfernen`, onclick: () => { list.splice(i, 1); draw(); } }, icon('trash')))),
        h('div', { class: 'duty-row' },
          h('input', { class: 'field', id: 'duty-new', placeholder: 'Neuer Dienst, z. B. Bereitschaft', 'aria-label': 'Neuer Dienst', enterkeyhint: 'done', onkeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); addDuty(); } } }),
          h('button', { class: 'go-btn', 'aria-label': 'Dienst hinzufügen', id: 'duty-add', onclick: addDuty }, icon('plus')))) : null),
    h('section', { class: 'bk' }, h('h4', null, 'Daten'),
      h('p', { class: 'bk-note' }, backupStatus().long),
      h('div', { class: 'bk-row' }, h('button', { class: 'btn', onclick: () => openMenu() }, 'Backup & Daten'))));
  draw();
  openDialog('Einstellungen', body, [
    h('button', { class: 'btn', onclick: () => $('#dlg').close() }, 'Abbrechen'),
    h('button', { class: 'btn primary', id: 'set-save', onclick: () => {
      const pending = $('#duty-new') && $('#duty-new').value.trim(); if (pending) list.push({ k: 'c' + uid(), label: pending });
      Settings.set('irregular', irregular);
      Settings.set('duties', list.map(x => ({ k: x.k, label: x.label.trim() })).filter(x => x.label));
      $('#dlg').close(); toast('Einstellungen gesichert'); render();
    } }, 'Sichern')]);
}

function reminderInfo() {
  const t = new Date(); t.setHours(12, 0, 0, 0);
  const tm = addDays(t, 1); const key = dkey(tm);
  const d = state.plan.days[key];
  if (!isWorkDay(d)) return null;
  const open = (d.meals || []).filter(m => ((m.recipeId && byId(m.recipeId)) || m.text) && !m.prepared);
  if (!open.length || Settings.get('remindHidden', '') === key) return null;
  return { key, date: tm, shift: { label: shiftLabel(d) }, open };
}
function renderReminder() {
  let el = $('#reminder'); const info = reminderInfo();
  if (!info || route().name === 'edit' || route().name === 'new') { if (el) el.remove(); return; }
  if (!el) { el = h('div', { id: 'reminder', class: 'reminder', role: 'status' }); document.body.append(el); }
  const n = info.open.length;
  el.replaceChildren(
    h('span', { class: 'ri' }, icon('pot')),
    h('div', { class: 'rt' }, h('b', null, 'Essen schon vorgekocht?'),
      h('small', null, `Morgen ${info.shift ? info.shift.label : 'Dienst'} · ${n} ${n === 1 ? 'Gericht' : 'Gerichte'} noch nicht vorbereitet`)),
    h('button', { class: 'rl', id: 'rem-later', onclick: () => { Settings.set('remindHidden', info.key); renderReminder(); } }, 'Später'),
    h('button', { class: 'rb', id: 'rem-open', onclick: () => openDayInWeek(info.date) }, 'Ansehen'));
}
function openDayInWeek(date) {
  const diff = Math.round((date - weekStartDate(0)) / 864e5);
  state.weekOffset = Math.floor(diff / 7);
  state.dayKey = dkey(date);
  go('woche');
  setTimeout(() => {
    const c = document.querySelector(`[data-day="${dkey(date)}"]`);
    if (c) { if (!matchMedia('(max-width: 760px)').matches) c.scrollIntoView({ behavior: 'smooth', block: 'center' }); c.classList.remove('flash'); void c.offsetWidth; c.classList.add('flash'); }
  }, 60);
}

function openMealPicker(m) {
  let q = '';
  const list = h('div', { class: 'pick-list' });
  const portions = h('input', { class: 'field', id: 'pick-portions', inputmode: 'decimal', value: fmtIn(m.portions || 1), style: { width: '72px' } });
  const done = () => { $('#dlg').close(); persist('plan'); rerenderTab(); };
  const draw = () => {
    list.replaceChildren();
    const qq = q.trim().toLowerCase();
    const rs = state.recipes.filter(r => !qq || [r.title, ...r.tags].join(' ').toLowerCase().includes(qq)).sort((a, b) => (a.title || '').localeCompare(b.title || '', 'de'));
    if (!rs.length) list.append(h('p', null, 'Keine passenden Rezepte.'));
    rs.forEach(r => {
      const p = totals(r).portion; const vb = volBucket(r);
      list.append(h('button', { class: 'rel' + (m.recipeId === r.id ? ' sel' : ''), 'data-pick': r.id,
        onclick: () => { m.recipeId = r.id; m.text = ''; m.portions = parseNum(portions.value) || 1; done(); } },
        thumb(r), h('div', { style: { minWidth: '0' } }, h('b', null, r.title || 'Ohne Titel'), h('span', { class: 'num' }, `${vb ? VOL_BUCKETS[vb].emoji + ' ' : ''}${fmt(p.kcal)} kcal · ${fmt(p.protein)} g Protein`))));
    });
  };
  const txt = h('input', { class: 'field', id: 'pick-text', value: m.text || '', placeholder: 'z. B. Indisch, Reste, Essen mit Freunden',
    onkeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); useText(); } } });
  const useText = () => { const t = txt.value.trim(); if (!t) return; m.text = t; m.recipeId = ''; done(); };
  openDialog(`${m.type} planen`, [
    h('div', { class: 'inline-add' },
      h('input', { class: 'field', id: 'pick-q', type: 'search', placeholder: 'Rezept suchen', oninput: (e) => { q = e.target.value; draw(); } }),
      h('label', { class: 'inline-opts', style: { flex: 'none' } }, 'Portionen', portions)),
    list,
    h('span', { class: 'cap', style: { padding: '0' } }, 'Oder als Notiz'),
    h('div', { class: 'inline-add' }, txt, h('button', { class: 'btn', id: 'pick-text-ok', onclick: useText }, 'Übernehmen')),
  ], [h('button', { class: 'btn', onclick: () => $('#dlg').close() }, 'Abbrechen')]);
  draw();
  setTimeout(() => $('#pick-q') && $('#pick-q').focus(), 50);
}

function openPlanDialog(r) {
  const start = new Date(); start.setHours(12, 0, 0, 0);
  const days = [...Array(14)].map((_, i) => addDays(start, i));
  let key = dkey(days[0]);
  const box = h('div', { class: 'pick-list', style: { maxHeight: 'none' } });
  const info = h('p');
  const portions = h('input', { class: 'field', id: 'plan-portions', inputmode: 'decimal', value: '1', style: { width: '72px' } });
  const assign = (m) => {
    m.recipeId = r.id; m.text = ''; m.portions = parseNum(portions.value) || 1;
    persist('plan'); $('#dlg').close();
    const d = days.find(x => dkey(x) === key);
    toast(`📅 ${r.title} für ${WD[d.getDay()]}, ${fmtDM(d)} eingeplant`);
  };
  const draw = () => {
    const d = dayData(key);
    info.replaceChildren(`${d.shift ? shiftLabel(d) + (d.place ? ' · ' + d.place : '') : d.place ? d.place : 'Keine Arbeit eingetragen'}${d.events.length ? ' · Termine: ' + d.events.map(e => (e.time ? e.time + ' ' : '') + e.text).join(', ') : ''}`);
    box.replaceChildren(...d.meals.map(m => {
      const cur = m.recipeId && byId(m.recipeId);
      return h('button', { class: 'rel', 'data-slot': m.type, onclick: () => assign(m) }, h('span', { style: { fontSize: '24px', textAlign: 'center' } }, MEAL_TYPES[m.type] || '🍽️'),
        h('div', { style: { minWidth: '0' } }, h('b', null, m.type), h('span', null, cur ? `ersetzt: ${cur.title}` : m.text ? `ersetzt: ${m.text}` : 'noch frei')));
    }), d.meals.length < MAX_MEALS ? h('button', { class: 'rel', id: 'plan-new', onclick: () => { const m = { id: uid(), type: d.meals.length === 2 ? 'Abendessen' : 'Snack' }; d.meals.push(m); assign(m); } },
      h('span', { style: { fontSize: '24px', textAlign: 'center' } }, '➕'), h('div', null, h('b', null, 'Weitere Mahlzeit'), h('span', null, `${d.meals.length}/${MAX_MEALS} belegt`))) : null);
  };
  openDialog(`${r.title || 'Rezept'} einplanen`, [
    h('div', { class: 'inline-opts' },
      h('label', null, 'Tag ', h('select', { id: 'plan-day', onchange: (e) => { key = e.target.value; draw(); } },
        days.map((d, i) => h('option', { value: dkey(d) }, `${WD[d.getDay()]}, ${fmtDM(d)}${i === 0 ? ' (heute)' : i === 1 ? ' (morgen)' : ''}`)))),
      h('label', null, 'Portionen ', portions)),
    info, box,
  ], [h('button', { class: 'btn', onclick: () => $('#dlg').close() }, 'Abbrechen')]);
  draw();
}

/* =========================================================
   Vorratskiste
   ========================================================= */
const EMOJI_HINTS = [
  [/udon|ramen|glasnudel/, '🍜'], [/nudel|pasta|maccheroni|makkaroni|lasagne|spaghetti|penne|fusilli|hörnchen/, '🍝'], [/milchreis|reis/, '🍚'],
  [/tomate/, '🍅'], [/bohne|linse|kichererbse/, '🫘'], [/mais/, '🌽'], [/kokos/, '🥥'], [/thunfisch|lachs|fisch|sardell|forelle/, '🐟'],
  [/kartoffel/, '🥔'], [/wrap|tortilla/, '🌮'], [/hafer|müsli|granola/, '🌾'], [/marmelade|konfitüre|erdbeer|himbeer/, '🍓'],
  [/nuss|nüsse|cashew|erdnuss|mandel|pistazie/, '🥜'], [/gurke|cornichon/, '🥒'], [/schoko|kakao/, '🍫'], [/öl\b|olivenöl|öl$/, '🫒'],
  [/essig|balsamico/, '🍶'], [/milch|skyr|quark|joghurt|kefir/, '🥛'], [/\beier?\b|eiklar/, '🥚'], [/hähnchen|huhn|pute/, '🍗'],
  [/rind|hack|steak/, '🥩'], [/käse|parmesan|mozzarella|feta/, '🧀'], [/apfel/, '🍎'], [/banane/, '🍌'], [/birne/, '🍐'], [/beere/, '🫐'],
  [/zwiebel/, '🧅'], [/knoblauch/, '🧄'], [/brot|toast|brötchen/, '🍞'], [/whey|protein/, '💪'], [/nori|sushi/, '🍣'], [/reispapier/, '🍙'], [/pilz|champignon/, '🍄'],
];
function guessEmoji(name) { const n = (name || '').toLowerCase(); const hit = EMOJI_HINTS.find(([re]) => re.test(n)); return hit ? hit[1] : ''; }
const shopNorm = (s) => (s || '').toLowerCase().replace(/\(.*?\)/g, ' ').replace(/[^a-z0-9äöüß ]/g, ' ').replace(/\s+/g, ' ').trim();
function matchPantry(name) {
  const n = shopNorm(name); if (n.length < 3) return null;
  let best = null;
  for (const it of state.pantry.items) {
    const m = shopNorm(it.name); if (!m) continue;
    if (m === n) return it;
    if (best) continue;
    if ((m.length >= 4 && (' ' + n + ' ').includes(' ' + m)) || (n.length >= 4 && (' ' + m + ' ').includes(' ' + n))) { best = it; continue; }
    const w1 = n.split(' ')[0], w2 = m.split(' ')[0];
    if (w1.length >= 5 && w1 === w2) best = it;
  }
  return best;
}
const inStock = (it) => !!it && (it.qty == null || it.qty > 0);
function pantryBadge(it) {
  if (!it) return null;
  if (it.qty == null) return h('span', { class: 'pbadge have', title: 'Vorrat: ' + it.name }, '🫙 im Vorrat');
  if (it.qty > 0) return h('span', { class: 'pbadge have', title: 'Vorrat: ' + it.name }, `🫙 ${fmt(it.qty)}x im Vorrat`);
  return h('span', { class: 'pbadge out', title: 'Vorrat: ' + it.name }, '🫙 Vorrat leer');
}
function applyPantryFilter() {
  const q = (state.pq || '').trim().toLowerCase();
  document.querySelectorAll('.pitem[data-name]').forEach(el => { el.hidden = !!q && !el.dataset.name.includes(q); });
  document.querySelectorAll('.pcat').forEach(c => { c.hidden = !!q && !c.querySelector('.pitem:not([hidden])'); });
}
function pantryPage() {
  const P = state.pantry;
  const empties = P.items.filter(i => i.qty === 0);
  const wrap = h('div', { class: 'tp' });
  wrap.append(h('div', { class: 'tp-head' },
    h('div', null, h('h1', null, 'Vorrat'), h('div', { class: 'sub' }, `${P.items.length} Artikel · ${empties.length} aufgebraucht`)),
    h('div', { class: 'tp-actions' },
      h('label', { class: 'search', style: { width: '240px' } }, icon('search'),
        h('input', { id: 'pq', type: 'search', placeholder: 'Im Vorrat suchen', value: state.pq, 'aria-label': 'Im Vorrat suchen', oninput: (e) => { state.pq = e.target.value; applyPantryFilter(); } })),
      empties.length ? h('button', { class: 'btn', id: 'pantry-empties', onclick: () => {
        const n = addShopItems(empties.map(i => ({ name: i.name, amount: '', unit: '', source: 'Vorrat aufgebraucht' })));
        toast(`🛒 ${n} aufgebrauchte Artikel auf der Einkaufsliste`); rerenderTab();
      } }, icon('cart'), `Aufgebrauchtes auf die Liste (${empties.length})`) : null,
      h('button', { class: 'btn', id: 'pantry-addcat', onclick: addPantryCat }, icon('plus'), 'Kategorie'))));
  wrap.append(h('p', { class: 'muted', style: { margin: '0' } }, 'Mit − und + zählst du Packungen. Bei 0 ist der Artikel aufgebraucht. Name antippen zum Umbenennen.'));
  wrap.append(h('div', { class: 'pantry-grid' }, P.cats.map(pantryCat)));
  return wrap;
}
function addPantryCat() {
  const nm = h('input', { class: 'field', id: 'cat-name', placeholder: 'z. B. Tiefkühler', onkeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); ok(); } } });
  const em = h('input', { class: 'field', id: 'cat-emoji', placeholder: '🧊', style: { width: '64px', textAlign: 'center' } });
  const ok = () => { const n = nm.value.trim(); if (!n) return; state.pantry.cats.push({ id: uid(), name: n, emoji: em.value.trim() || '📦' }); persist('pantry'); $('#dlg').close(); rerenderTab('padd-' + state.pantry.cats[state.pantry.cats.length - 1].id); };
  openDialog('Neue Kategorie', [h('div', { class: 'inline-add' }, em, nm)], [h('button', { class: 'btn', onclick: () => $('#dlg').close() }, 'Abbrechen'), h('button', { class: 'btn primary', id: 'cat-ok', onclick: ok }, 'Anlegen')]);
  setTimeout(() => nm.focus(), 50);
}
function pantryCat(c) {
  const items = state.pantry.items.filter(i => i.catId === c.id);
  const box = h('section', { class: 'pcat', 'data-cat': c.name });
  box.append(h('div', { class: 'pcat-head' }, h('span', { style: { fontSize: '20px' } }, c.emoji || '📦'), h('h3', null, c.name), h('span', { class: 'n' }, items.length),
    !items.length ? h('button', { class: 'mini del', 'aria-label': 'Kategorie löschen', onclick: () => { state.pantry.cats = state.pantry.cats.filter(x => x !== c); persist('pantry'); rerenderTab(); } }, icon('trash')) : null));
  items.forEach(it => box.append(pantryRow(it)));
  const inp = h('input', { class: 'field', id: 'padd-' + c.id, placeholder: '+ Artikel, z. B. 2x Kidneybohnen', 'aria-label': `Artikel zu ${c.name} hinzufügen`,
    onkeydown: (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const p = parseShopText(inp.value); if (!p.name) return;
      state.pantry.items.push({ id: uid(), catId: c.id, name: p.name, emoji: guessEmoji(p.name), qty: p.amount && (p.unit === 'x' || p.unit === 'Stück') ? p.amount : 1, note: '' });
      persist('pantry'); rerenderTab('padd-' + c.id);
    } });
  box.append(h('div', { class: 'add-row' }, inp));
  return box;
}
function pantryRow(it) {
  const setQ = (q) => { it.qty = q; persist('pantry'); rerenderTab(); };
  return h('div', { class: 'pitem' + (it.qty === 0 ? ' empty' : ''), 'data-name': it.name.toLowerCase(), 'data-pid': it.id },
    h('span', { class: 'em', 'aria-hidden': 'true' }, it.emoji || '·'),
    h('div', { style: { minWidth: '0' } },
      h('input', { class: 'nm', value: it.name, 'aria-label': 'Artikelname', onchange: (e) => { it.name = e.target.value.trim() || it.name; if (!it.emoji) it.emoji = guessEmoji(it.name); persist('pantry'); } }),
      it.note ? h('div', { class: 'muted', style: { fontSize: '11.5px', padding: '0 4px 4px' } }, it.note) : null),
    h('div', { class: 'stepper' },
      h('button', { 'aria-label': 'Weniger', 'data-minus': it.name, onclick: () => setQ(it.qty == null ? 0 : Math.max(0, it.qty - 1)) }, '−'),
      h('span', null, it.qty == null ? '1' : fmt(it.qty)),
      h('button', { 'aria-label': 'Mehr', 'data-plus': it.name, onclick: () => setQ(it.qty == null ? 2 : it.qty + 1) }, '+')),
    h('div', { class: 'acts' },
      h('button', { class: 'mini' + (it.qty === 0 ? ' hot' : ''), 'aria-label': 'Auf die Einkaufsliste', title: 'Auf die Einkaufsliste', onclick: () => {
        addShopItems([{ name: it.name, amount: '', unit: '', source: 'Vorrat' }]);
        toast(inStock(it) ? `🛒 ${it.name} auf der Liste. Hinweis: Du hast noch ${it.qty == null ? 'etwas' : fmt(it.qty) + 'x'} daheim.` : `🛒 ${it.name} auf der Liste`);
      } }, icon('cart')),
      h('button', { class: 'mini del', 'aria-label': 'Aus dem Vorrat entfernen', onclick: () => { state.pantry.items = state.pantry.items.filter(x => x !== it); persist('pantry'); rerenderTab(); } }, icon('trash'))));
}

/* =========================================================
   Einkaufsliste
   ========================================================= */
function parseShopText(t) {
  t = (t || '').trim();
  const m = t.match(/^(\d+(?:[.,]\d+)?)\s*(x|g|kg|ml|l|stk\.?|stück|el|tl|pck\.?|packungen?|dosen?|gläser|glas|becher)?\.?\s+(.+)$/i);
  if (!m) return { name: t, amount: '', unit: '' };
  const map = { 'stk': 'Stück', 'stk.': 'Stück', 'stück': 'Stück', 'pck': 'Packung', 'pck.': 'Packung', 'packung': 'Packung', 'packungen': 'Packung', 'dose': 'Dose', 'dosen': 'Dose', 'glas': 'Glas', 'gläser': 'Glas', 'el': 'EL', 'tl': 'TL', 'becher': 'Becher' };
  const u = m[2] ? (map[m[2].toLowerCase()] || m[2].toLowerCase()) : 'x';
  return { name: m[3].trim(), amount: parseNum(m[1]), unit: u };
}
const fmtShopAmt = (it) => { const n = parseNum(it.amount); if (!n) return ''; return it.unit === 'x' ? `${fmt(n, 1)}x` : `${fmt(n, 1)} ${it.unit || ''}`.trim(); };
function addShopItems(items) {
  let n = 0;
  for (const it of items) {
    if (!it.name || !it.name.trim()) continue;
    const ex = state.shop.find(s => !s.done && shopNorm(s.name) === shopNorm(it.name) && (s.unit || '') === (it.unit || ''));
    if (ex) {
      if (parseNum(ex.amount) && parseNum(it.amount)) ex.amount = Math.round((parseNum(ex.amount) + parseNum(it.amount)) * 10) / 10;
      if (it.source && !(ex.source || '').split(', ').includes(it.source)) ex.source = ex.source ? ex.source + ', ' + it.source : it.source;
    } else state.shop.push({ id: uid(), name: it.name.trim(), amount: it.amount ?? '', unit: it.unit || '', source: it.source || '', done: false, added: Date.now() });
    n++;
  }
  persist('shop'); renderTabbar(tabOf(route()));
  return n;
}
function openShopDialog(title, items, scale) {
  let factor = 1;
  const sel = items.map(it => !it.optional && !inStock(matchPantry(it.name)));
  const tbody = h('tbody');
  const btn = h('button', { class: 'btn primary', id: 'shop-apply' });
  const updBtn = () => { const n = sel.filter(Boolean).length; btn.textContent = `${n} ${n === 1 ? 'Zutat' : 'Zutaten'} hinzufügen`; btn.disabled = !n; };
  const scaled = (it) => parseNum(it.amount) ? Math.round(parseNum(it.amount) * factor * 10) / 10 : '';
  const draw = () => {
    tbody.replaceChildren(...items.map((it, i) => h('tr', null,
      h('td', null, h('input', { type: 'checkbox', class: 'check square', checked: sel[i], 'data-shopsel': it.name, 'aria-label': it.name + ' auswählen', onchange: (e) => { sel[i] = e.target.checked; updBtn(); } })),
      h('td', null, it.name, it.optional ? h('span', { class: 'opt-tag' }, 'Optional') : null, !scale && it.source ? h('div', { class: 'muted', style: { fontSize: '12px' } }, it.source) : null),
      h('td', { class: 'r' }, scaled(it) ? fmtShopAmt({ amount: scaled(it), unit: it.unit }) : '–'),
      h('td', null, pantryBadge(matchPantry(it.name))))));
    updBtn();
  };
  btn.onclick = () => {
    const take = items.map((it, i) => sel[i] ? { ...it, amount: scaled(it) } : null).filter(Boolean);
    const n = addShopItems(take);
    $('#dlg').close();
    toast(`🛒 ${n} ${n === 1 ? 'Zutat' : 'Zutaten'} auf der Einkaufsliste`);
    if (tabOf(route()) !== 'rezepte') rerenderTab();
  };
  openDialog(title, [
    scale ? h('label', { class: 'inline-opts' }, 'Einkaufen für', h('input', { class: 'field', id: 'shop-portions', inputmode: 'decimal', value: fmtIn(scale.servings), style: { width: '72px' },
      oninput: (e) => { factor = (parseNum(e.target.value) || scale.servings) / scale.servings; draw(); } }), 'Portionen') : null,
    h('p', null, 'Was du laut Vorratskiste noch daheim hast (🫙) und optionale Zutaten sind abgewählt.'),
    h('div', { class: 'preview-wrap' }, h('table', { class: 'preview', style: { minWidth: '0' } }, tbody)),
  ], [h('button', { class: 'btn', onclick: () => $('#dlg').close() }, 'Abbrechen'), btn]);
  draw();
}
function shopRecipe(r) {
  const items = r.ingredients.filter(i => i.name.trim()).map(i => ({ name: i.name, amount: i.amount, unit: i.unit, optional: i.optional, source: r.title }));
  if (!items.length) return toast('Das Rezept hat noch keine Zutaten.');
  openShopDialog(`🛒 ${r.title || 'Rezept'}`, items, { servings: Math.max(1, parseNum(r.servings) || 1) });
}
function shopWeek(datas) {
  const agg = new Map();
  for (const d of datas) for (const m of d.meals) {
    const r = m.recipeId && byId(m.recipeId); if (!r) continue;
    const f = (parseNum(m.portions) || 1) / Math.max(1, parseNum(r.servings) || 1);
    for (const i of r.ingredients) {
      if (!i.name.trim() || i.optional) continue;
      const k = shopNorm(i.name) + '|' + (i.unit || '');
      const cur = agg.get(k) || { name: i.name, unit: i.unit, amount: 0, sources: new Set() };
      cur.amount += parseNum(i.amount) * f; cur.sources.add(r.title);
      agg.set(k, cur);
    }
  }
  if (!agg.size) return toast('In dieser Woche sind noch keine Rezepte geplant.');
  const items = [...agg.values()].map(x => ({ name: x.name, unit: x.unit, amount: x.amount ? Math.round(x.amount * 10) / 10 : '', source: [...x.sources].join(', ') }))
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));
  openShopDialog('🛒 Einkauf für die Woche', items, null);
}
function shopPage() {
  const open = state.shop.filter(i => !i.done), done = state.shop.filter(i => i.done);
  const wrap = h('div', { class: 'tp' }); const inner = h('div', { class: 'shop-wrap' });
  inner.append(h('div', { class: 'tp-head' },
    h('div', null, h('h1', null, 'Einkauf'), h('div', { class: 'sub' }, open.length ? `${open.length} offen${done.length ? ` · ${done.length} erledigt` : ''}` : done.length ? 'Alles erledigt 🎉' : 'Noch leer')),
    h('div', { class: 'tp-actions' }, h('button', { class: 'btn', id: 'shop-copy', disabled: !open.length, onclick: copyShop }, icon('copy'), 'Liste kopieren'))));
  const hint = h('div', { class: 'pantry-hint', id: 'shop-hint', hidden: true });
  const inp = h('input', { class: 'field', id: 'shop-input', placeholder: 'Was brauchst du? z. B. 500 g Magerquark', 'aria-label': 'Neuer Eintrag',
    oninput: () => {
      const p = parseShopText(inp.value); const m = p.name.length >= 3 ? matchPantry(p.name) : null;
      hint.hidden = !m;
      if (m) hint.replaceChildren(inStock(m) ? `🫙 Hinweis: ${m.name} hast du laut Vorratskiste noch daheim${m.qty ? ` (${fmt(m.qty)}x)` : ''}.` : `🫙 ${m.name} ist laut Vorratskiste aufgebraucht. Gut, dass es auf die Liste kommt.`);
    },
    onkeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } } });
  const add = () => { const p = parseShopText(inp.value); if (!p.name) return; addShopItems([p]); rerenderTab('shop-input'); };
  inner.append(h('div', { class: 'shop-add' }, inp, h('button', { class: 'btn primary', id: 'shop-add', onclick: add }, icon('plus'), 'Hinzufügen')), hint);
  if (!state.shop.length) inner.append(h('div', { class: 'empty-state' }, h('div', { style: { fontSize: '40px' } }, '🛒'), h('p', null, 'Trag oben etwas ein oder hol dir Zutaten aus einem Rezept („Einkaufen“) oder dem Wochenplan („Woche einkaufen“).')));
  if (open.length) inner.append(h('div', { class: 'shop-list', id: 'shop-open' }, open.map(shopRow)));
  if (done.length) inner.append(
    h('div', { class: 'tp-head', style: { alignItems: 'center' } }, h('span', { class: 'cap' }, 'Erledigt'),
      h('div', { class: 'tp-actions' },
        h('button', { class: 'btn', id: 'shop-to-pantry', onclick: doneToPantry }, '🫙 In den Vorrat übernehmen'),
        h('button', { class: 'btn danger', id: 'shop-clear', onclick: () => { state.shop = state.shop.filter(i => !i.done); persist('shop'); rerenderTab(); } }, 'Erledigte löschen'))),
    h('div', { class: 'shop-list', id: 'shop-done' }, done.map(shopRow)));
  wrap.append(inner);
  return wrap;
}
function shopRow(it) {
  const pm = it.done ? null : matchPantry(it.name);
  return h('div', { class: 'sitem' + (it.done ? ' done' : ''), 'data-item': it.name },
    h('input', { type: 'checkbox', class: 'check', checked: it.done, 'aria-label': it.name + ' abhaken', onchange: (e) => { it.done = e.target.checked; persist('shop'); rerenderTab(); } }),
    h('div', { style: { minWidth: '0' } }, h('div', { class: 'nm' }, it.name),
      (it.source || pm) ? h('div', { class: 'meta' }, it.source ? h('span', null, `für ${it.source}`) : null, pantryBadge(pm)) : null),
    h('span', { class: 'amt' }, fmtShopAmt(it)),
    h('button', { class: 'mini del', 'aria-label': it.name + ' entfernen', onclick: () => { state.shop = state.shop.filter(x => x !== it); persist('shop'); rerenderTab(); } }, icon('x')));
}
async function copyShop() {
  const text = state.shop.filter(i => !i.done).map(i => `• ${fmtShopAmt(i) ? fmtShopAmt(i) + ' ' : ''}${i.name}`).join('\n');
  try { await navigator.clipboard.writeText(text); toast('📋 Liste kopiert'); }
  catch (e) {
    const ta = h('textarea', { style: { position: 'fixed', opacity: '0' } }); ta.value = text; document.body.append(ta); ta.select();
    try { document.execCommand('copy'); toast('📋 Liste kopiert'); } catch (e2) { toast('Kopieren nicht möglich.'); }
    ta.remove();
  }
}
function doneToPantry() {
  const done = state.shop.filter(i => i.done); let upd = 0, neu = 0;
  for (const it of done) {
    const m = matchPantry(it.name);
    const count = ['x', 'Stück', 'Dose', 'Packung', 'Glas', 'Becher'].includes(it.unit) && parseNum(it.amount) ? parseNum(it.amount) : 1;
    if (m) { m.qty = (m.qty == null ? 1 : m.qty) + count; upd++; }
    else {
      let cat = state.pantry.cats.find(c => c.name === 'Neu eingekauft');
      if (!cat) { cat = { id: uid(), name: 'Neu eingekauft', emoji: '🆕' }; state.pantry.cats.push(cat); }
      state.pantry.items.push({ id: uid(), catId: cat.id, name: it.name, emoji: guessEmoji(it.name), qty: count, note: '' }); neu++;
    }
  }
  state.shop = state.shop.filter(i => !i.done);
  persist('shop'); persist('pantry');
  toast(`🫙 ${upd} im Vorrat aufgefüllt, ${neu} neu angelegt`);
  rerenderTab();
}

/* ---------- Startdaten (bewusst ohne persönliche Daten) ---------- */
function seedPantry() {
  const data = [
    ['Kochen', '🍳', [['Passierte Tomaten', '🍅', 2], ['Kidneybohnen', '🫘', 2], ['Kokosmilch light', '🥥', 1]]],
    ['Carbquellen', '🍝', [['Basmati-Reis', '🍚', 1], ['Vollkornnudeln', '🍝', 1]]],
    ['Frühstück', '🥣', [['Haferflocken', '🌾', 1]]],
    ['Beiwerk', '🥜', [['Walnüsse', '🥜', 1]]],
    ['Flüssiges', '🫗', [['Olivenöl', '🫒', 1]]],
    ['Süßzeug', '🍫', [['Zartbitter-Schokolade', '🍫', 0]]],
  ];
  const P = { cats: [], items: [] };
  for (const [name, emoji, items] of data) {
    const c = { id: uid(), name, emoji }; P.cats.push(c);
    for (const [n, e, q, note] of items) P.items.push({ id: uid(), catId: c.id, name: n, emoji: e, qty: q === undefined ? 1 : q, note: note || '' });
  }
  return P;
}
function seedPlan() { return { days: {} }; }

/* ---------- Fünf weitere Beispielrezepte (fiktiv, Richtwerte) ---------- */
function demoRecipes() {
  const R = (o) => normalize(Object.assign({ example: true, notes: 'Beispielrezept mit Richtwerten.' }, o));
  const t0 = Date.now() - 60000;
  return [
    R({ id: 'demo-chili', title: 'Chili sin Carne', subtitle: 'Bohnen, Mais und Sojahack, perfekt zum Vorkochen', servings: 3, prepMin: 15, cookMin: 30,
      tags: ['Hauptmahlzeit', 'High Fibre', 'Volumenreich', 'Meal Prep', 'Vegan', 'Deftig'], updatedAt: t0,
      ingredients: [
        { name: 'Kidneybohnen, abgetropft', amount: 480, unit: 'g', kcal: 509, carbs: 62, fat: 2.4, protein: 34 },
        { name: 'Sojagranulat', amount: 60, unit: 'g', kcal: 210, carbs: 7.8, fat: 0.6, protein: 30 },
        { name: 'Passierte Tomaten', amount: 500, unit: 'g', kcal: 120, carbs: 20, fat: 1, protein: 6 },
        { name: 'Mais', amount: 140, unit: 'g', kcal: 112, carbs: 21, fat: 1.7, protein: 3.6 },
        { name: 'Paprika rot', amount: 200, unit: 'g', kcal: 62, carbs: 12, fat: 0.6, protein: 2 },
        { name: 'Zwiebel', amount: 100, unit: 'g', kcal: 40, carbs: 9, fat: 0.1, protein: 1.1 },
        { name: 'Olivenöl', amount: 10, unit: 'ml', kcal: 88, carbs: 0, fat: 10, protein: 0 },
        { name: 'Skyr als Topping', amount: 100, unit: 'g', kcal: 63, carbs: 4, fat: 0.2, protein: 11, optional: true },
      ],
      spiceGroups: [{ name: 'Chili', step: 2, spices: [{ name: 'Kreuzkümmel', amount: '1 TL' }, { name: 'Paprika geräuchert', amount: '2 TL' }, { name: 'Chili', amount: '½ TL' }, { name: 'Salz', amount: '' }] }],
      steps: ['Zwiebel und Paprika würfeln und im Öl anschwitzen.', 'Sojagranulat und Gewürze dazugeben, kurz mitrösten.', 'Tomaten, Bohnen und Mais einrühren und 25 Minuten köcheln lassen.', 'Abschmecken und mit Skyr servieren.'],
      notes: 'Beispielrezept mit Richtwerten. Hält 4 Tage im Kühlschrank.' }),
    R({ id: 'demo-skyrbowl', title: 'Skyr-Bowl mit Beeren', subtitle: 'Fünf Minuten, viel Protein, viel Volumen', servings: 1, prepMin: 5,
      tags: ['Frühstück', 'Snack', 'Abnehmgeeignet', 'High Protein', 'Volumenreich', 'Schnell', 'Süß'], updatedAt: t0 - 1000,
      ingredients: [
        { name: 'Skyr natur', amount: 300, unit: 'g', kcal: 189, carbs: 12, fat: 0.6, protein: 33 },
        { name: 'TK-Beeren', amount: 150, unit: 'g', kcal: 63, carbs: 11, fat: 0.5, protein: 1.5 },
        { name: 'Haferflocken', amount: 20, unit: 'g', kcal: 74, carbs: 11.7, fat: 1.4, protein: 2.7 },
        { name: 'Zero-Sirup', amount: 10, unit: 'ml', kcal: 0.5, carbs: 0.1, fat: 0, protein: 0 },
        { name: 'Walnüsse', amount: 10, unit: 'g', kcal: 65, carbs: 0.7, fat: 6.5, protein: 1.5, optional: true },
      ],
      spiceGroups: [{ name: 'Topping', step: 2, spices: [{ name: 'Zimt', amount: '1 Prise' }] }],
      steps: ['Beeren kurz antauen lassen und mit dem Skyr verrühren.', 'Haferflocken trocken anrösten und darüberstreuen, Sirup drauf.'],
      warnings: ['sucht'] }),
    R({ id: 'demo-ofen', title: 'Ofengemüse mit Feta', subtitle: 'Kartoffeln, Zucchini und Kichererbsen vom Blech', servings: 2, prepMin: 15, cookMin: 35,
      tags: ['Hauptmahlzeit', 'Vegetarisch', 'Volumenreich', 'Deftig'], updatedAt: t0 - 2000,
      ingredients: [
        { name: 'Kartoffeln', amount: 400, unit: 'g', kcal: 288, carbs: 60, fat: 0.4, protein: 8 },
        { name: 'Zucchini', amount: 300, unit: 'g', kcal: 57, carbs: 6.6, fat: 1, protein: 4.5 },
        { name: 'Paprika gelb', amount: 200, unit: 'g', kcal: 62, carbs: 12, fat: 0.6, protein: 2 },
        { name: 'Kichererbsen, abgetropft', amount: 240, unit: 'g', kcal: 300, carbs: 40, fat: 5, protein: 17 },
        { name: 'Feta light', amount: 150, unit: 'g', kcal: 270, carbs: 1.5, fat: 16.5, protein: 27 },
        { name: 'Olivenöl', amount: 15, unit: 'ml', kcal: 132, carbs: 0, fat: 15, protein: 0 },
      ],
      spiceGroups: [{ name: 'Gemüse', step: 1, spices: [{ name: 'Rosmarin', amount: '1 TL' }, { name: 'Thymian', amount: '1 TL' }, { name: 'Knoblauchpulver', amount: '½ TL' }, { name: 'Paprika edelsüß', amount: '1 TL' }] }],
      steps: ['Gemüse in Stücke schneiden, mit Öl und Gewürzen mischen.', 'Kichererbsen dazugeben und alles bei 200 °C 30 Minuten backen.', 'Feta zerbröseln, darüberstreuen und 5 Minuten mitbacken.'] }),
    R({ id: 'demo-teriyaki', title: 'Teriyaki-Hähnchen mit Reis', subtitle: 'Die Aufbau-Pfanne für zwei Tage', servings: 2, prepMin: 10, cookMin: 20,
      tags: ['Aufbaugeeignet', 'Hauptmahlzeit', 'High Protein', 'Meal Prep', 'Deftig'], updatedAt: t0 - 3000,
      ingredients: [
        { name: 'Hähnchenbrust', amount: 400, unit: 'g', kcal: 440, carbs: 0, fat: 4.8, protein: 92 },
        { name: 'Basmati-Reis, roh', amount: 150, unit: 'g', kcal: 525, carbs: 117, fat: 1.2, protein: 11 },
        { name: 'Brokkoli', amount: 300, unit: 'g', kcal: 102, carbs: 8, fat: 1.2, protein: 8.4 },
        { name: 'Teriyaki-Sauce', amount: 60, unit: 'ml', kcal: 54, carbs: 10, fat: 0, protein: 3.6 },
        { name: 'Sesam', amount: 10, unit: 'g', kcal: 57, carbs: 1, fat: 5, protein: 1.8 },
        { name: 'Sonnenblumenöl', amount: 10, unit: 'ml', kcal: 88, carbs: 0, fat: 10, protein: 0 },
        { name: 'Frühlingszwiebel', amount: 30, unit: 'g', kcal: 10, carbs: 2, fat: 0, protein: 0.5, optional: true },
      ],
      spiceGroups: [{ name: 'Marinade', step: 2, spices: [{ name: 'Ingwer', amount: '1 TL' }, { name: 'Knoblauchpulver', amount: '½ TL' }, { name: 'Chili', amount: '1 Prise' }] }],
      steps: ['Reis nach Packung kochen.', 'Hähnchen würfeln, würzen und im Öl scharf anbraten.', 'Brokkoli dazugeben, mit Teriyaki-Sauce ablöschen und 5 Minuten schmoren.', 'Mit Reis anrichten, Sesam darüberstreuen.'] }),
    R({ id: 'demo-oats', title: 'Zimt-Apfel Overnight Oats', subtitle: 'Abends vorbereiten, morgens mitnehmen', servings: 1, prepMin: 10, totalMin: 480,
      tags: ['Frühstück', 'Abnehmgeeignet', 'Meal Prep', 'Süß'], updatedAt: t0 - 4000,
      ingredients: [
        { name: 'Haferflocken', amount: 50, unit: 'g', kcal: 186, carbs: 29.3, fat: 3.5, protein: 6.8 },
        { name: 'Magerquark', amount: 150, unit: 'g', kcal: 102, carbs: 6, fat: 0.5, protein: 18 },
        { name: 'Milch 1,5 %', amount: 100, unit: 'ml', kcal: 47, carbs: 4.8, fat: 1.5, protein: 3.4 },
        { name: 'Apfel', amount: 120, unit: 'g', kcal: 62, carbs: 14, fat: 0.2, protein: 0.4 },
        { name: 'Chiasamen', amount: 10, unit: 'g', kcal: 49, carbs: 0.8, fat: 3.1, protein: 1.7 },
        { name: 'Kokoschips', amount: 5, unit: 'g', kcal: 33, carbs: 0.4, fat: 3.2, protein: 0.3, optional: true },
      ],
      spiceGroups: [{ name: 'Oats', step: 1, spices: [{ name: 'Zimt', amount: '1 TL' }, { name: 'Vanille', amount: '1 Prise' }] }],
      steps: ['Haferflocken, Quark, Milch, Chiasamen und Gewürze in einem Glas verrühren.', 'Apfel reiben und unterheben.', 'Über Nacht in den Kühlschrank stellen.'] }),
  ];
}

/* ---------- Beispielrezepte ---------- */
function seedRecipes() {
  const a = normalize({
    id: 'bsp-pancakes', example: true, title: 'Protein Pancakes', subtitle: 'Fluffige Basis für jeden Morgen im Winter Arc',
    servings: 1, prepMin: 5, cookMin: 10, source: '', tags: ['Abnehmgeeignet', 'Frühstück', 'High Protein', 'Schnell', 'Süß'],
    ingredients: [
      { name: 'Haferflocken, zart', amount: 50, unit: 'g', kcal: 186, carbs: 29.3, fat: 3.5, protein: 6.8 },
      { name: 'Whey Vanille', amount: 30, unit: 'g', kcal: 117, carbs: 2.1, fat: 1.8, protein: 23.1 },
      { name: 'Eiklar', amount: 100, unit: 'g', kcal: 49, carbs: 0.7, fat: 0.2, protein: 11 },
      { name: 'Milch 1,5 %', amount: 60, unit: 'ml', kcal: 28, carbs: 2.9, fat: 0.9, protein: 2 },
      { name: 'Backpulver', amount: 5, unit: 'g', kcal: 5, carbs: 1.2, fat: 0, protein: 0 },
      { name: 'Heidelbeeren', amount: 50, unit: 'g', kcal: 29, carbs: 6.1, fat: 0.3, protein: 0.3, optional: true },
      { name: 'Zero-Sirup Ahorn', amount: 20, unit: 'ml', kcal: 1, carbs: 0.2, fat: 0, protein: 0, optional: true },
    ],
    spiceGroups: [{ name: 'Teig', step: 1, spices: [{ name: 'Zimt', amount: '1 TL' }, { name: 'Vanille', amount: '1 Prise' }, { name: 'Salz', amount: '1 Prise' }] }],
    steps: [
      'Haferflocken fein mahlen und mit Whey, Backpulver und den Gewürzen mischen.',
      'Eiklar und Milch einrühren, bis ein glatter Teig entsteht. 5 Minuten quellen lassen.',
      'Beschichtete Pfanne auf mittlere Hitze bringen, kleine Pancakes ausbacken und wenden, sobald sich Bläschen bilden.',
      'Mit Heidelbeeren und Zero-Sirup servieren.',
    ],
    notes: 'Beispielrezept. Werte sind Richtwerte, ersetze sie durch deine eigenen aus MyFitnessPal.\nTeig nicht zu heiß ausbacken, sonst wird Whey schnell trocken.',
    links: ['bsp-birne'], updatedAt: Date.now() - 2000,
  });
  const b = normalize({
    id: 'bsp-birne', example: true, title: 'Protein Pancakes mit Birne', subtitle: 'Winter-Variante mit Spekulatius-Quark-Topping',
    servings: 1, prepMin: 10, cookMin: 12, tags: ['Abnehmgeeignet', 'Frühstück', 'High Protein', 'Volumenreich', 'Süß'], warnings: ['sucht'],
    ingredients: [
      { name: 'Haferflocken, zart', amount: 50, unit: 'g', kcal: 186, carbs: 29.3, fat: 3.5, protein: 6.8 },
      { name: 'Whey Vanille', amount: 30, unit: 'g', kcal: 117, carbs: 2.1, fat: 1.8, protein: 23.1 },
      { name: 'Eiklar', amount: 100, unit: 'g', kcal: 49, carbs: 0.7, fat: 0.2, protein: 11 },
      { name: 'Birne', amount: 150, unit: 'g', kcal: 86, carbs: 18.6, fat: 0.2, protein: 0.5 },
      { name: 'Magerquark', amount: 100, unit: 'g', kcal: 68, carbs: 4, fat: 0.3, protein: 12 },
      { name: 'Backpulver', amount: 5, unit: 'g', kcal: 5, carbs: 1.2, fat: 0, protein: 0 },
      { name: 'Walnüsse, gehackt', amount: 10, unit: 'g', kcal: 65, carbs: 0.7, fat: 6.5, protein: 1.5, optional: true },
    ],
    spiceGroups: [
      { name: 'Teig', step: 1, spices: [{ name: 'Zimt', amount: '1 TL' }, { name: 'Nelken', amount: '1 Prise, gemahlen' }] },
      { name: 'Topping', step: 4, spices: [{ name: 'Spekulatiusgewürz', amount: '½ TL' }] },
    ],
    steps: [
      'Haferflocken mahlen, mit Whey, Backpulver, Zimt und Nelken mischen. Eiklar einrühren.',
      'Die Hälfte der Birne fein würfeln und unter den Teig heben, den Rest in Spalten schneiden.',
      'Pancakes bei mittlerer Hitze ausbacken. Birnenspalten kurz in der Pfanne karamellisieren.',
      'Magerquark mit Spekulatiusgewürz und einem Schuss Wasser cremig rühren und als Topping verwenden.',
    ],
    notes: 'Beispielrezept. Variante der Protein Pancakes.',
    links: ['bsp-pancakes'], updatedAt: Date.now(),
  });
  return [a, b];
}

/* ---------- Start ---------- */
(async function init() {
  await Store.init();
  state.recipes = (await Store.all()).map(r => Object.assign(normalize(r), { example: !!r.example }));
  if (!state.recipes.length && !Settings.get('seeded', false)) {
    state.recipes = seedRecipes();
    try { if (Store.mode === 'ls') Store._lsWrite(); else await Store.putMany(state.recipes); } catch (e) {}
    Settings.set('seeded', true);
  }
  if (!Settings.get('demo5', false)) {
    const add = demoRecipes().filter(r => !byId(r.id));
    state.recipes.push(...add);
    try { if (Store.mode === 'ls') Store._lsWrite(); else await Store.putMany(add); } catch (e) {}
    Settings.set('demo5', true);
  }
  state.plan = await KV.get('plan', null);
  if (!state.plan) { state.plan = Settings.get('planSeeded', false) ? { days: {} } : seedPlan(); Settings.set('planSeeded', true); KV.set('plan', state.plan); }
  state.plan.days = state.plan.days || {};
  state.pantry = await KV.get('pantry', null);
  if (!state.pantry) { state.pantry = seedPantry(); KV.set('pantry', state.pantry); }
  if (state.pantry.items.some(i => i.qty == null)) { state.pantry.items.forEach(i => { if (i.qty == null) i.qty = 1; }); KV.set('pantry', state.pantry); }
  state.shop = await KV.get('shop', []);
  if (Store.mode === 'memory') toast('Dieser Browser speichert die Datei nicht dauerhaft. Backup nutzen!');
  // iOS gewährt das vor allem Apps auf dem Home-Bildschirm. Schützt vor Löschung bei Speicherknappheit.
  try { if (navigator.storage && navigator.storage.persist && !(await navigator.storage.persisted())) navigator.storage.persist(); } catch (e) {}
  const isWide = matchMedia('(min-width: 821px)').matches;
  if (!location.href.includes('#')) history.replaceState(null, '', '#woche');
  onRoute();
  window.__app = { state, Store, KV, Settings, parseMFP, totals, matchPantry, parseShopText, deleteRecipe, buildBackup, detectImport, safeImage };
})();

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
  navigator.serviceWorker.register('./sw.js').then(reg => {
    if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w && w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w); });
    });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
  }).catch(() => {});
}
