const CACHE_NAME = "traduchat-v1";
const FILES_TO_CACHE = [
  "/", // si usas ruta base
  "/index.html",
  "/styles.css",
  "/script.js",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600&display=swap",
  "https://fonts.gstatic.com"
];

// INSTALACIÓN: cachea archivos esenciales
self.addEventListener("install", (event) => {
  console.log("[SW] Instalando y cacheando recursos...");
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(FILES_TO_CACHE))
  );
  self.skipWaiting();
});

// ACTIVACIÓN: limpia caches antiguas
self.addEventListener("activate", (event) => {
  console.log("[SW] Activado");
  event.waitUntil(
    caches.keys().then((keyList) =>
      Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            console.log("[SW] Borrando cache antigua:", key);
            return caches.delete(key);
          }
        })
      )
    )
  );
  self.clients.claim();
});

// FETCH: responde desde cache o red
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((response) => {
      return (
        response ||
        fetch(event.request).catch(() =>
          caches.match("/offline.html") // si quieres, añade un archivo offline
        )
      );
    })
  );
});
