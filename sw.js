// Guarda la app en el celular para que abra rápido. Siempre intenta la versión nueva primero.
// "no-cache" hace que el navegador pregunte al servidor en vez de usar una copia vieja guardada.
const CACHE = "caja-v23";
const SHELL = ["./", "index.html", "styles.css", "js/app.js", "js/config.js", "manifest.webmanifest", "icons/icon.svg", "icons/icon-192.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: "reload" }))))); self.skipWaiting() });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))); self.clients.claim() });
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  // La librería de Supabase viene de jsDelivr con la versión fija: se guarda para poder abrir sin internet.
  if (url.hostname === "cdn.jsdelivr.net") {
    e.respondWith(caches.match(e.request).then(c => c || fetch(e.request).then(r => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(x => x.put(e.request, copy)) } return r })));
    return;
  }
  if (url.origin !== location.origin) return;
  e.respondWith(fetch(url.href, { cache: "no-cache", credentials: "same-origin" })
    .then(r => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)) } return r })
    .catch(() => caches.match(e.request, { ignoreSearch: true })));
});
