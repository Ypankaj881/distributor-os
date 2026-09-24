// Minimal service worker: makes the app installable on phones.
// It deliberately does NOT cache pages or API responses — prices, stock and
// order status must always be live, never an old copy.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
// A fetch handler that lets every request go to the network as normal.
self.addEventListener("fetch", () => {});
