// Service worker del panel: lo hace instalable y permite abrirlo sin conexión (solo la
// carcasa; los datos siempre vienen de Supabase). Estrategia "red primero": si hay internet
// siempre se usa la versión más nueva, así nadie tiene que actualizar nada a mano.
const CACHE = "panel-v1";

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      Promise.allSettled(["./", "./manifest.json", "../css/styles.css", "../css/turnero.css", "../css/panel.css"].map((u) => c.add(u)))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  // Solo archivos propios; Supabase, fuentes y demás van directo a la red
  if (req.method !== "GET" || url.origin !== location.origin) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) { const copia = res.clone(); caches.open(CACHE).then((c) => c.put(req, copia)); }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }))
  );
});
