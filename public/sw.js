// Self-destructing service worker.
// A previous project ("Caudal") registered a PWA service worker on this origin
// (localhost) that keeps serving stale cached assets. This worker replaces it,
// unregisters itself, clears all caches, and reloads open tabs.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
        await self.registration.unregister();
        const clients = await self.clients.matchAll({ type: "window" });
        for (const client of clients) {
          client.navigate(client.url);
        }
      } catch {
        // best effort
      }
    })(),
  );
});
