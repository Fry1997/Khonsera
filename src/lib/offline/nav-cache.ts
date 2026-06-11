// On-device store for saved navigation routes + their corridor map tiles —
// the "route ahead" half of offline nav (the ticket cache is the other half
// of the offline substrate; separate DB so the two never version-conflict).
//
// `routes` holds SavedNavRoute JSON. `tiles` holds raster tile blobs keyed
// "z/x/y" with a refcount-ish `route_ids` list so deleting a route can sweep
// tiles no other saved route still needs.

import type { SavedNavRoute } from "@/lib/nav/types";
import { tileKey, type TileCoord } from "@/lib/nav/tiles";

const DB_NAME = "khonsera-nav";
const DB_VERSION = 1;
const ROUTES = "routes";
const TILES = "tiles";

type TileRecord = { key: string; blob: Blob; route_ids: string[] };

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === "undefined") return resolve(null);
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      return resolve(null);
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(ROUTES)) db.createObjectStore(ROUTES, { keyPath: "id" });
      if (!db.objectStoreNames.contains(TILES)) db.createObjectStore(TILES, { keyPath: "key" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
    tx.onabort = () => resolve();
  });
}

export async function saveNavRoute(route: SavedNavRoute): Promise<void> {
  const db = await openDb();
  if (!db) return;
  const tx = db.transaction(ROUTES, "readwrite");
  tx.objectStore(ROUTES).put(route);
  await txDone(tx);
  db.close();
}

export async function listNavRoutes(): Promise<SavedNavRoute[]> {
  const db = await openDb();
  if (!db) return [];
  const routes = await new Promise<SavedNavRoute[]>((resolve) => {
    try {
      const req = db.transaction(ROUTES, "readonly").objectStore(ROUTES).getAll();
      req.onsuccess = () => resolve((req.result as SavedNavRoute[]) ?? []);
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
  db.close();
  return routes.sort((a, b) => b.saved_at.localeCompare(a.saved_at));
}

export async function deleteNavRoute(id: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  // Sweep tiles: drop this route's claim; delete tiles nobody claims.
  const tx = db.transaction([ROUTES, TILES], "readwrite");
  tx.objectStore(ROUTES).delete(id);
  const tileStore = tx.objectStore(TILES);
  const cursorReq = tileStore.openCursor();
  cursorReq.onsuccess = () => {
    const cursor = cursorReq.result;
    if (!cursor) return;
    const rec = cursor.value as TileRecord;
    if (rec.route_ids.includes(id)) {
      const remaining = rec.route_ids.filter((r) => r !== id);
      if (remaining.length === 0) cursor.delete();
      else cursor.update({ ...rec, route_ids: remaining });
    }
    cursor.continue();
  };
  await txDone(tx);
  db.close();
}

export async function getTileBlob(key: string): Promise<Blob | null> {
  const db = await openDb();
  if (!db) return null;
  const blob = await new Promise<Blob | null>((resolve) => {
    try {
      const req = db.transaction(TILES, "readonly").objectStore(TILES).get(key);
      req.onsuccess = () => resolve((req.result as TileRecord | undefined)?.blob ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  db.close();
  return blob;
}

async function putTiles(records: TileRecord[]): Promise<void> {
  const db = await openDb();
  if (!db) return;
  const tx = db.transaction(TILES, "readwrite");
  const store = tx.objectStore(TILES);
  for (const rec of records) {
    // Merge claims if another route already pinned this tile.
    const getReq = store.get(rec.key);
    getReq.onsuccess = () => {
      const existing = getReq.result as TileRecord | undefined;
      const route_ids = existing
        ? [...new Set([...existing.route_ids, ...rec.route_ids])]
        : rec.route_ids;
      store.put({ key: rec.key, blob: existing?.blob ?? rec.blob, route_ids });
    };
  }
  await txDone(tx);
  db.close();
}

const OSM_SUBDOMAINS = ["a", "b", "c"];

export function osmTileUrl(t: TileCoord): string {
  const sub = OSM_SUBDOMAINS[(t.x + t.y) % OSM_SUBDOMAINS.length];
  return `https://${sub}.tile.openstreetmap.org/${t.z}/${t.x}/${t.y}.png`;
}

// Fetch + pin the corridor tiles for a saved route. Modest concurrency, and
// failures are skipped, not fatal — a saved route with 95% of its tiles still
// navigates; the missing ones just show paper-coloured gaps.
export async function prefetchTiles(
  tiles: TileCoord[],
  routeId: string,
  onProgress?: (done: number, total: number) => void,
): Promise<number> {
  let done = 0;
  let stored = 0;
  const queue = [...tiles];
  const CONCURRENCY = 6;

  async function worker() {
    const batch: TileRecord[] = [];
    for (;;) {
      const t = queue.shift();
      if (!t) break;
      try {
        const res = await fetch(osmTileUrl(t));
        if (res.ok) {
          batch.push({ key: tileKey(t), blob: await res.blob(), route_ids: [routeId] });
          stored++;
        }
      } catch {
        /* skip — offline gap, not a failure */
      }
      done++;
      onProgress?.(done, tiles.length);
      if (batch.length >= 25) {
        await putTiles(batch.splice(0));
      }
    }
    if (batch.length) await putTiles(batch);
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return stored;
}
