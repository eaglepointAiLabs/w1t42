const APP_SHELL_CACHE = "trailforge-app-shell-v2";
const RUNTIME_CACHE = "trailforge-runtime-v1";
const LEGACY_PRIVATE_API_CACHE = "trailforge-api-get-v1";
const CLEAR_PRIVATE_CACHES_MESSAGE = "TRAILFORGE_CLEAR_PRIVATE_CACHES";

const APP_SHELL_URLS = ["/", "/index.html"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then((cache) => cache.addAll(APP_SHELL_URLS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => ![APP_SHELL_CACHE, RUNTIME_CACHE].includes(key))
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

function shouldHandleRuntimeAsset(request, url) {
  if (request.method !== "GET") {
    return false;
  }
  if (url.origin !== self.location.origin) {
    return false;
  }
  return ["style", "script", "font", "image"].includes(request.destination) || url.pathname.startsWith("/assets/");
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) {
    return cached;
  }
  const network = await fetch(request);
  if (network && network.ok) {
    cache.put(request, network.clone());
  }
  return network;
}

async function clearPrivateCaches() {
  await caches.delete(LEGACY_PRIVATE_API_CACHE);
}

self.addEventListener("message", (event) => {
  if (event?.data?.type === CLEAR_PRIVATE_CACHES_MESSAGE) {
    event.waitUntil(clearPrivateCaches());
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(APP_SHELL_CACHE);
        return cache.match("/index.html");
      })
    );
    return;
  }

  if (shouldHandleRuntimeAsset(request, url)) {
    event.respondWith(cacheFirst(request, RUNTIME_CACHE));
  }
});
