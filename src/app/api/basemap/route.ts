import type { NextRequest } from "next/server";

// Same-origin PMTiles proxy. The Protomaps demo bucket (and most third-party
// archives) won't serve cross-origin range requests to our origin — the browser
// CORS-blocks them ("Failed to fetch"). CORS is a browser construct, so we move
// the fetch server-side: the browser range-requests THIS route (same-origin, no
// CORS), and we forward the Range to the real archive and stream the bytes back.
//
// Point the client at this route with NEXT_PUBLIC_PMTILES_URL=/api/basemap.
// The upstream archive is server-only (never exposed as the fetched origin):
// PMTILES_UPSTREAM_URL, defaulting to the Protomaps demo bucket for dev. Self-
// host a regional extract and set PMTILES_UPSTREAM_URL for production traffic.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UPSTREAM =
  process.env.PMTILES_UPSTREAM_URL ?? "https://demo-bucket.protomaps.com/v4.pmtiles";

// Headers worth passing through so the PMTiles client sees a real ranged 206.
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

  let upstream: Response;
  try {
    upstream = await fetch(UPSTREAM, {
      headers: { Range: range },
      cache: "no-store",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch failed";
    return new Response(`basemap upstream unreachable: ${msg}`, { status: 502 });
  }

  if (!upstream.ok && upstream.status !== 206) {
    return new Response(`basemap upstream HTTP ${upstream.status}`, {
      status: upstream.status === 404 ? 404 : 502,
    });
  }

  const body = await upstream.arrayBuffer();
  const headers = new Headers();
  for (const h of PASS_THROUGH) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }
  headers.set("Cache-Control", "public, max-age=86400, s-maxage=86400");

  return new Response(body, { status: upstream.status, headers });
}
