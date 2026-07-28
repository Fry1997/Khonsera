/*
 * Khonsera service worker — the offline spine for the day-of surfaces. The point
 * is the barrier: you got off the train with no signal and needed your Aztec. The
 * Aztec already draws on-device (bwip-js) from a saved payload; what was missing
 * was the app booting at all with no network. This caches the shell so it does.
 *
 * Conservative by design (it ships to the live PWA on a real phone):
 *   - Hashed build assets (/_next/static) → cache-first (safe: content-hashed).
 *   - Page navigations → network-first, fall back to the last cached snapshot,
 *     then to /offline (which reads the on-device ticket cache). So fresh content
 *     online, last-known content offline — never a stale app that can't update.
 *   - Cross-origin (Supabase, Darwin, fonts) is never touched — those just fail
 *     offline and the UI keeps its last-known state.
 *
 * Bump VERSION to roll the caches (old ones are deleted on activate).
 */

const VERSION = "khonsera-v2";
const STATIC_CACHE = `${VERSION}-static`;
const PAGE_CACHE = `${VERSION}-pages`;

// Minimal precache: the emergency offline ticket surface + the icons/manifest.
const PRECACHE = ["/offline", "/manifest.webmanifest", "/icon.svg"];

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
        keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }
  // Only ever handle our own origin — never proxy Supabase / Darwin / fonts.
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(req));
    return;
  }
  if (req.mode === "navigate") {
    event.respondWith(networkFirstPage(req));
    return;
  }
  // Same-origin static files (icons, brand images, manifest).
  event.respondWith(staleWhileRevalidate(req));
});

async function cacheFirst(req) {
  const cache = await caches.open(STATIC_CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    return hit || Response.error();
  }
}

async function networkFirstPage(req) {
  const cache = await caches.open(PAGE_CACHE);
  try {
    const res = await fetch(req);
    // Cache only real, full responses (not opaque redirects/partials).
    if (res.ok && res.type === "basic") cache.put(req, res.clone());
    return res;
  } catch {
    const hit = await cache.match(req);
    if (hit) return hit;
    const offline = await caches.match("/offline");
    return offline || Response.error();
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(STATIC_CACHE);
  const hit = await cache.match(req);
  const fetching = fetch(req)
    .then((res) => {
      if (res.ok && res.type === "basic") cache.put(req, res.clone());
      return res;
    })
    .catch(() => hit);
  return hit || fetching;
}
