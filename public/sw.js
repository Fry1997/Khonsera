/*
 * Khonsera service worker — the offline spine for the day-of surfaces.
 *
 * Only immutable, content-hashed Next.js assets are cache-first. Full document
 * navigations are network-first with an offline fallback. Next.js router/RSC
 * payloads are always network-only: caching those responses can combine a new
 * application shell with an obsolete component tree after a deployment.
 */

const deploymentVersion =
  new URL(self.location.href).searchParams.get("v") || "development";
const VERSION = `khonsera-${deploymentVersion}`;
const STATIC_CACHE = `${VERSION}-static`;
const PAGE_CACHE = `${VERSION}-pages`;

const PRECACHE = ["/offline", "/manifest.webmanifest", "/icon.svg"];
const SAFE_STATIC_PATHS = new Set(["/manifest.webmanifest", "/icon.svg"]);

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      await cache.addAll(PRECACHE).catch(() => {
        /* a precache miss must not block install */
      });
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => !key.startsWith(VERSION))
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    void self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  if (url.origin !== self.location.origin) return;

  // React Server Component and Next router payloads are deployment-specific.
  // Never read or write them through Cache Storage, even while online.
  if (isNextRouteData(request, url)) {
    event.respondWith(fetch(request, { cache: "no-store" }));
    return;
  }

  // These filenames are content-hashed, so a cache hit is always the same file.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Full documents remain available offline, but online always wins.
  if (request.mode === "navigate") {
    event.respondWith(networkFirstPage(request));
    return;
  }

  // Cache only the deliberately offline-safe manifest and icon. API responses,
  // route handlers and all other application data stay under normal networking.
  if (SAFE_STATIC_PATHS.has(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});

function isNextRouteData(request, url) {
  return Boolean(
    url.pathname.startsWith("/_next/data/") ||
      url.searchParams.has("_rsc") ||
      request.headers.get("RSC") === "1" ||
      request.headers.has("Next-Router-State-Tree") ||
      request.headers.has("Next-Router-Prefetch"),
  );
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;

  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch {
    return hit || Response.error();
  }
}

async function networkFirstPage(request) {
  const cache = await caches.open(PAGE_CACHE);

  try {
    const response = await fetch(request, { cache: "no-store" });
    if (response.ok && response.type === "basic") {
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    const hit = await cache.match(request);
    if (hit) return hit;
    const offline = await caches.match("/offline");
    return offline || Response.error();
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(STATIC_CACHE);
  const hit = await cache.match(request);
  const fetching = fetch(request)
    .then(async (response) => {
      if (response.ok && response.type === "basic") {
        await cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => hit);

  return hit || fetching;
}
