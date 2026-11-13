/* Timone · service worker
   Serve sempre i file installati (anche senza rete) e NON si aggiorna da solo:
   la nuova versione viene scaricata solo quando l'utente preme "Aggiorna",
   che cancella questa copia e ricarica la pagina. */
var CACHE = 'timone-app';
var FILE = ['./', 'index.html', 'app.js', 'motore.js', 'simulatore.js', 'importa.js', 'xbrl.js', 'commesse.js', 'ui-commesse.js', 'magazzino.js', 'ui-magazzino.js', 'personale.js', 'ui-personale.js', 'energia.js', 'ui-energia.js', 'produzione.js', 'ui-produzione.js', 'investimenti.js', 'ui-investimenti.js', 'decisioni.js', 'ui-decisioni.js', 'finanziamenti.js', 'ui-finanziamenti.js', 'commerciale.js', 'ui-commerciale.js', 'dati.js', 'manifest.json', 'icona.svg'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(FILE.map(function (f) { return fetch(f, { cache: 'reload' }).then(function (r) { if (r.ok) return c.put(f, r); }); }));
  }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', function (e) {
  var u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.endsWith('versione.json')) return; // rete
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(function (r) { return r || fetch(e.request); }));
});
