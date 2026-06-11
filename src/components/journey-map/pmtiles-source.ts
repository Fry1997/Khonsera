"use client";

import maplibregl from "maplibre-gl";
import { PMTiles } from "pmtiles";
import { getTileBlob, osmTileUrl } from "@/lib/offline/nav-cache";
import type { TileCoord } from "@/lib/nav/tiles";

// The basemap tile substrate. One env var flips the whole app between the
// always-works raster OSM basemap (default) and the premium Protomaps v4 vector
// basemap (set NEXT_PUBLIC_PMTILES_URL). Both flow through one MapLibre protocol
// — `khnav://z/x/y` — that serves the on-device cache first (saved routes pin a
// corridor there) then the network, so offline behaves the same in either mode.
//
// Production note: the default points at the Protomaps demo bucket, which is
// fair-use/dev-only. Self-host a regional .pmtiles extract for real traffic and
// set NEXT_PUBLIC_PMTILES_URL to it (env var only) — same posture as Valhalla.

const PROTOCOL = "khnav";

export function pmtilesUrl(): string | null {
  const u = process.env.NEXT_PUBLIC_PMTILES_URL;
  return u && u.length > 0 ? u : null;
}

export function vectorEnabled(): boolean {
  return pmtilesUrl() !== null;
}

export function basemapProtocolUrl(): string {
  return `${PROTOCOL}://{z}/{x}/{y}`;
}

// Protomaps v4 tiles top out at z15; MapLibre overzooms beyond.
export const VECTOR_MAXZOOM = 15;

let pm: PMTiles | null = null;
export function getPMTiles(): PMTiles | null {
  const url = pmtilesUrl();
  if (!url) return null;
  if (!pm) pm = new PMTiles(url);
  return pm;
}

let registered = false;

// Register the `khnav://` protocol once per page. Vector mode returns decoded
// PBF (PMTiles.getZxy decompresses internally); raster mode returns PNG bytes.
// Cache (IndexedDB) is tried first in both modes.
export function registerBasemapProtocol(): void {
  if (registered) return;
  registered = true;

  maplibregl.addProtocol(PROTOCOL, async (params) => {
    const m = /^khnav:\/\/(\d+)\/(\d+)\/(\d+)$/.exec(params.url);
    if (!m) throw new Error("bad tile url");
    const z = Number(m[1]);
    const x = Number(m[2]);
    const y = Number(m[3]);

    const cached = await getTileBlob(`${z}/${x}/${y}`);
    if (cached) return { data: await cached.arrayBuffer() };

    const tiles = getPMTiles();
    if (tiles) {
      const res = await tiles.getZxy(z, x, y);
      if (res?.data) return { data: new Uint8Array(res.data) };
      return { data: new Uint8Array() }; // missing tile — empty, not an error
    }

    // Raster fallback (no PMTiles configured): OSM PNG.
    const r = await fetch(osmTileUrl({ z, x, y }));
    if (!r.ok) throw new Error(`tile ${r.status}`);
    return { data: await r.arrayBuffer() };
  });
}

// Fetch one tile's bytes for offline pinning. Vector → decoded PBF from the
// PMTiles archive; raster → OSM PNG blob.
export async function fetchBasemapTile(t: TileCoord): Promise<Blob | null> {
  const tiles = getPMTiles();
  if (tiles) {
    if (t.z > VECTOR_MAXZOOM) return null; // overzoomed at render time
    const res = await tiles.getZxy(t.z, t.x, t.y);
    if (!res?.data) return null;
    return new Blob([new Uint8Array(res.data)]);
  }
  const r = await fetch(osmTileUrl(t));
  if (!r.ok) return null;
  return await r.blob();
}

// Diagnose why vector tiles aren't loading: is the archive reachable at all?
// Distinguishes a wrong URL (404) from a CORS/network block (the usual cause
// when a third-party bucket doesn't allow this origin's range requests).
export async function probePmtiles(): Promise<string> {
  const url = pmtilesUrl();
  if (!url) return "no NEXT_PUBLIC_PMTILES_URL set";
  try {
    const res = await fetch(url, { headers: { Range: "bytes=0-15" } });
    if (res.ok || res.status === 206) return `archive reachable (HTTP ${res.status}) — tile/CORS detail issue`;
    return `archive HTTP ${res.status} at ${url} — check the URL`;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch failed";
    return `blocked (CORS or network): ${msg} — ${url}`;
  }
}
