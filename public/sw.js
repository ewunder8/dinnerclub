// dinnerclub Service Worker
// Minimal SW — satisfies PWA installability requirements.
// The app relies on server-rendered data, so we don't cache pages.

const CACHE_NAME = "dinnerclub-v1";

// Cache only static assets that rarely change
const PRECACHE = ["/"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Remove old caches
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Network-first for all requests — keeps server data fresh
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});
