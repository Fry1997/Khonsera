#!/usr/bin/env node
/**
 * Backfill rail polylines from OpenStreetMap's Overpass API.
 *
 * Run from your machine (NOT Vercel — Overpass blocks cloud IPs):
 *
 *   node scripts/backfill-rail-polylines.mjs
 *
 * What it does:
 *   1. Finds all locked train transitions missing polylines
 *   2. Queries Overpass for actual railway track geometry
 *   3. Stores encoded polylines in rail_route_cache + transitions
 *
 * The cache is keyed by station pair (e.g. WEL→LEI). Once cached,
 * the app reads from the cache — Overpass is never called at runtime.
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 * in .env.local (or passed as env vars).
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env.local
try {
  const envPath = resolve(import.meta.dirname, "..", ".env.local");
  const envFile = readFileSync(envPath, "utf8");
  for (const line of envFile.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
} catch {
  // .env.local might not exist — rely on env vars
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n" +
    "Set them in .env.local or pass as environment variables."
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  console.log("Finding transitions missing polylines...\n");

  const { data: missing, error } = await supabase
    .from("transitions")
    .select(`
      id, mode, from_stop_id, to_stop_id,
      from_stop:stops!transitions_from_stop_id_fkey(
        transport_hub:transport_hubs(code, latitude, longitude)
      ),
      to_stop:stops!transitions_to_stop_id_fkey(
        transport_hub:transport_hubs(code, latitude, longitude)
      )
    `)
    .eq("is_locked", true)
    .is("overview_polyline", null);

  if (error) {
    console.error("Query failed:", error.message);
    process.exit(1);
  }

  if (!missing || missing.length === 0) {
    console.log("All transitions already have polylines. Nothing to do.");
    return;
  }

  console.log(`Found ${missing.length} transition(s) to backfill.\n`);

  let filled = 0;
  let cached = 0;
  let failed = 0;

  for (const t of missing) {
    const fh = first(t.from_stop?.transport_hub);
    const th = first(t.to_stop?.transport_hub);

    if (!fh?.latitude || !fh?.longitude || !th?.latitude || !th?.longitude) {
      console.log(`  SKIP ${t.id} — missing hub coordinates`);
      failed++;
      continue;
    }

    const fromCode = fh.code ?? "?";
    const toCode = th.code ?? "?";
    const label = `${fromCode}→${toCode}`;

    // Check cache first
    if (fh.code && th.code) {
      const { data: hit } = await supabase
        .from("rail_route_cache")
        .select("encoded_polyline")
        .eq("from_station_code", fh.code)
        .eq("to_station_code", th.code)
        .single();

      if (hit?.encoded_polyline) {
        console.log(`  CACHE ${label} (${hit.encoded_polyline.length} chars)`);
        await supabase
          .from("transitions")
          .update({ overview_polyline: hit.encoded_polyline })
          .eq("id", t.id);
        cached++;
        filled++;
        continue;
      }
    }

    // Query Overpass
    process.stdout.write(`  FETCH ${label} ...`);
    const points = await queryOverpass(
      Number(fh.latitude), Number(fh.longitude),
      Number(th.latitude), Number(th.longitude),
    );

    if (!points || points.length < 2) {
      console.log(" FAILED (no path found)");
      failed++;
      continue;
    }

    const encoded = encodePolyline(points);
    console.log(` OK (${points.length} points, ${encoded.length} chars)`);

    // Write to transition
    await supabase
      .from("transitions")
      .update({ overview_polyline: encoded })
      .eq("id", t.id);

    // Write to cache
    if (fh.code && th.code) {
      await supabase.from("rail_route_cache").upsert(
        {
          from_station_code: fh.code,
          to_station_code: th.code,
          encoded_polyline: encoded,
          point_count: points.length,
        },
        { onConflict: "from_station_code,to_station_code" },
      );
    }

    filled++;

    // Be polite to Overpass — 2s between requests
    await sleep(2000);
  }

  console.log(`\nDone: ${filled} filled (${cached} from cache), ${failed} failed.`);
}

// ── Overpass query ──────────────────────────────────────────────────

async function queryOverpass(fromLat, fromLng, toLat, toLng) {
  const minLat = Math.min(fromLat, toLat) - 0.05;
  const maxLat = Math.max(fromLat, toLat) + 0.05;
  const minLng = Math.min(fromLng, toLng) - 0.05;
  const maxLng = Math.max(fromLng, toLng) + 0.05;

  const query = `
    [out:json][timeout:30];
    way["railway"="rail"]["service"!~"siding|yard|crossover|spur"](${minLat},${minLng},${maxLat},${maxLng});
    (._;>;);
    out body;
  `;

  const resp = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Khonsera/1.0 (rail route cache builder)",
    },
    body: `data=${encodeURIComponent(query)}`,
    signal: AbortSignal.timeout(35_000),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    console.error(`\n    Overpass HTTP ${resp.status}: ${text.slice(0, 200)}`);
    return null;
  }

  const json = await resp.json();

  const nodes = new Map();
  const ways = [];

  for (const el of json.elements ?? []) {
    if (el.type === "node" && el.lat != null && el.lon != null) {
      nodes.set(el.id, { lat: el.lat, lng: el.lon });
    } else if (el.type === "way" && el.nodes) {
      ways.push({ id: el.id, nodeIds: el.nodes });
    }
  }

  if (ways.length === 0) return null;

  const fromNode = findNearestNode(nodes, fromLat, fromLng);
  const toNode = findNearestNode(nodes, toLat, toLng);
  if (!fromNode || !toNode || fromNode === toNode) return null;

  return bfsPath(ways, nodes, fromNode, toNode);
}

function findNearestNode(nodes, lat, lng) {
  let best = null;
  let bestDist = Infinity;
  for (const [id, pt] of nodes) {
    const d = (pt.lat - lat) ** 2 + (pt.lng - lng) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = id;
    }
  }
  return best;
}

function bfsPath(ways, nodes, startNode, endNode) {
  const adj = new Map();
  for (const way of ways) {
    for (let i = 0; i < way.nodeIds.length - 1; i++) {
      const a = way.nodeIds[i];
      const b = way.nodeIds[i + 1];
      if (!adj.has(a)) adj.set(a, []);
      if (!adj.has(b)) adj.set(b, []);
      adj.get(a).push(b);
      adj.get(b).push(a);
    }
  }

  const visited = new Set();
  const parent = new Map();
  const queue = [startNode];
  visited.add(startNode);

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === endNode) {
      const path = [];
      let node = endNode;
      while (node != null) {
        path.unshift(node);
        node = parent.get(node);
      }
      return path
        .map((id) => nodes.get(id))
        .filter((pt) => pt != null);
    }
    for (const neighbor of adj.get(current) ?? []) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        parent.set(neighbor, current);
        queue.push(neighbor);
      }
    }
  }

  return null;
}

// ── Polyline encoding ───────────────────────────────────────────────

function encodePolyline(points) {
  let encoded = "";
  let prevLat = 0;
  let prevLng = 0;
  for (const { lat, lng } of points) {
    const latE5 = Math.round(lat * 1e5);
    const lngE5 = Math.round(lng * 1e5);
    encoded += encodeValue(latE5 - prevLat);
    encoded += encodeValue(lngE5 - prevLng);
    prevLat = latE5;
    prevLng = lngE5;
  }
  return encoded;
}

function encodeValue(value) {
  let v = value < 0 ? ~(value << 1) : value << 1;
  let encoded = "";
  while (v >= 0x20) {
    encoded += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
    v >>= 5;
  }
  encoded += String.fromCharCode(v + 63);
  return encoded;
}

// ── Helpers ─────────────────────────────────────────────────────────

function first(v) {
  if (v == null) return null;
  return Array.isArray(v) ? v[0] : v;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
