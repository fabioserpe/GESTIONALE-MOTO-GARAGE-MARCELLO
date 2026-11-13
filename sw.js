const CACHE = 'garage-v223';
const APP_SHELL = [
  '/GESTIONALE-MOTO-GARAGE-MARCELLO/',
  '/GESTIONALE-MOTO-GARAGE-MARCELLO/index.html'
];
// Librerie esterne: salvate anche loro, così il gestionale si apre senza internet (v219)
const ESTERNI = [
  'https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js',
  'https://www.gstatic.com/firebasejs/8.10.1/firebase-database.js',
  'https://www.gstatic.com/firebasejs/8.10.1/firebase-auth.js',
  'https://www.gstatic.com/firebasejs/8.10.1/firebase-firestore.js',
  'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
];
// Altri file esterni da tenere quando vengono scaricati la prima volta (mai i dati di Firebase né il meteo)
const DA_TENERE = /^https:\/\/(www\.gstatic\.com\/firebasejs\/|cdnjs\.cloudflare\.com\/ajax\/libs\/|fonts\.googleapis\.com\/|fonts\.gstatic\.com\/)/;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(APP_SHELL).then(() =>
    Promise.all(ESTERNI.map(u => fetch(u, { mode: 'no-cors' }).then(r => c.put(u, r)).catch(() => {})))
  )));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // La cassa del collaboratore (v221) è una pagina a parte e vuole internet: mai sostituirla con il gestionale salvato
  if (/\/cassa\.html(?:[?#]|$)/.test(e.request.url)) return;
  const pagina = e.request.mode === 'navigate';
  e.respondWith(
    caches.match(e.request, { ignoreSearch: pagina }).then(cached => cached || fetch(e.request).then(r => {
      if (DA_TENERE.test(e.request.url) && (r.ok || r.type === 'opaque')) {
        const copia = r.clone();
        caches.open(CACHE).then(c => c.put(e.request, copia));
      }
      return r;
    }).catch(err => {
      // Senza rete: per la pagina si usa quella salvata
      if (pagina) return caches.match('/GESTIONALE-MOTO-GARAGE-MARCELLO/index.html');
      throw err;
    }))
  );
});
