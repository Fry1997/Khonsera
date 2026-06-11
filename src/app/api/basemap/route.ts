import type { NextRequest } from "next/server";

// Same-origin PMTiles proxy. Third-party archives (incl. Protomaps' build
// server) won't serve cross-origin range requests to our origin — the browser
// CORS-blocks them ("Failed to fetch"). CORS is a browser construct, so we move
// the fetch server-side: the browser range-requests THIS route (same-origin, no
// CORS) and we forward the Range to the real archive and return the bytes.
//
// Point the client at this route with NEXT_PUBLIC_PMTILES_URL=/api/basemap.
//
// Upstream archive (server-only, never the fetched origin):
//   - PMTILES_UPSTREAM_URL  → an explicit, stable .pmtiles (the production path:
//     self-host a regional extract and set this).
//   - unset → auto-resolve Protomaps' daily planet build (v4 schema, matches
//     protomaps-themes-base v4), walking back from yesterday to the newest build
//     that exists. Self-maintaining so the URL never rots. Dev/fair-use only —
//     self-host for real traffic.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUILD_BASE = "https://build.protomaps.com";
const EXPLICIT = process.env.PMTILES_UPSTREAM_URL;

// Resolved upstream for this server instance. An explicit env URL wins outright;
// otherwise we discover the newest daily build once and cache it. We start at
// yesterday (UTC) — today's build may be mid-publish — and GC only removes the
// OLDEST builds, so "newest existing ≤ yesterday" is stable across instances.
let resolved: string | null = EXPLICIT ?? null;
let resolving: Promise<string> | null = null;

function ymd(d: Date): string {
  return (
    String(d.getUTCFullYear()) +
    String(d.getUTCMonth() + 1).padStart(2, "0") +
    String(d.getUTCDate()).padStart(2, "0")
  );
}

async function rangeOk(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { headers: { Range: "bytes=0-15" }, cache: "no-store" });
    return res.ok || res.status === 206;
  } catch {
    return false;
  }
}

async function resolveUpstream(): Promise<string> {
  if (resolved) return resolved;
  if (!resolving) {
    resolving = (async () => {
      const now = Date.now();
      for (let back = 1; back <= 14; back++) {
        const url = `${BUILD_BASE}/${ymd(new Date(now - back * 86_400_000))}.pmtiles`;
        if (await rangeOk(url)) return url;
      }
      throw new Error("no recent Protomaps build found in the last 14 days");
    })();
    resolving
      .then((u) => {
        resolved = u;
      })
      .catch(() => {})
      .finally(() => {
        resolving = null;
      });
  }
  return resolving;
}

const PASS_THROUGH = [
  "content-type",
  "content-length",
  "content-range",
  "accept-ranges",
  "etag",
  "last-modified",
];

export async function GET(req: NextRequest) {
  const range = req.headers.get("range");
  // PMTiles always sends a Range; refuse a full-archive pull (the planet is
  // tens of GB) so a stray un-ranged GET can't hammer the upstream.
  if (!range) {
    return new Response("range required", { status: 416 });
  }

  let upstream: string;
  try {
    upstream = await resolveUpstream();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "resolve failed";
    return new Response(`basemap: ${msg}`, { status: 502 });
  }

  let res: Response;
  try {
    res = await fetch(upstream, { headers: { Range: range }, cache: "no-store" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch failed";
    return new Response(`basemap upstream unreachable: ${msg}`, { status: 502 });
  }

  // An auto-resolved build that 404s has likely been GC'd — drop it so the next
  // request re-resolves to the current newest. (Explicit env URLs aren't reset.)
  if (res.status === 404 && !EXPLICIT) {
    resolved = null;
  }

  if (!res.ok && res.status !== 206) {
    return new Response(`basemap upstream HTTP ${res.status}`, {
      status: res.status === 404 ? 404 : 502,
    });
  }

  const body = await res.arrayBuffer();
  const headers = new Headers();
  for (const h of PASS_THROUGH) {
    const v = res.headers.get(h);
    if (v) headers.set(h, v);
  }
  headers.set("Cache-Control", "public, max-age=86400, s-maxage=86400");

  return new Response(body, { status: res.status, headers });
}
