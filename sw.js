/* Trip Split offline helper: keeps a copy of the app on the phone.
   Expenses are never stored here: they live in the Google Sheet (and on the phone until sent). */
const CACHE = 'tripsplit-v18';
const SHELL = ['./', './index.html', './apple-touch-icon.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);
  // live expense data: always straight to Google, never cached here
  if(/script\.google(usercontent)?\.com$/.test(url.hostname)) return;
  if(req.mode === 'navigate' || (url.origin === location.origin && /\/(index\.html)?$/.test(url.pathname))){
    e.respondWith(appPage(url)); return;
  }
  if(url.origin === location.origin || /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname) || url.hostname === 'cdn.jsdelivr.net'){
    e.respondWith(cacheThenRefresh(req));
  }
});

// newest app when online (no stale 10-minute cache), saved copy when offline or jammed
async function appPage(url){
  const cache = await caches.open(CACHE);
  try{
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 4000);
    const res = await fetch(url.origin + url.pathname, {cache: 'no-cache', signal: ctl.signal});
    clearTimeout(t);
    if(res.ok){ cache.put('./index.html', res.clone()); return res; }
    throw new Error('bad status');
  }catch(err){
    return (await cache.match('./index.html')) || (await cache.match('./')) ||
      new Response('<h2 style="font-family:sans-serif">Open Trip Split once with internet, then it works offline.</h2>', {headers: {'Content-Type': 'text/html'}});
  }
}
async function cacheThenRefresh(req){
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  const net = fetch(req).then(res => { if(res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()); return res; }).catch(() => hit);
  return hit || net;
}
