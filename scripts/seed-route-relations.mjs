// Process the Overpass JSON export and seed rail_named_route_segments
// Run: node scripts/seed-route-relations.mjs

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

console.log("Loading JSON...");
const data = JSON.parse(readFileSync("/tmp/export.json", "utf8"));

console.log("Building lookups...");
const nodeMap = new Map();
const wayMap = new Map();
const relations = [];

for (const el of data.elements) {
  if (el.type === "node" && el.lat != null) nodeMap.set(el.id, { lat: el.lat, lon: el.lon });
  else if (el.type === "way" && el.nodes) wayMap.set(el.id, el.nodes);
  else if (el.type === "relation") relations.push(el);
}

console.log(`${nodeMap.size} nodes, ${wayMap.size} ways, ${relations.length} relations`);

// Load transport hubs for station matching
console.log("Loading transport hubs...");
const { data: hubs } = await supabase
  .from("transport_hubs")
  .select("code, name, latitude, longitude")
  .eq("kind", "rail_station")
  .not("code", "is", null)
  .not("latitude", "is", null);

const hubList = (hubs || []).map(h => ({
  code: h.code,
  name: h.name,
  lat: Number(h.latitude),
  lng: Number(h.longitude),
}));
console.log(`${hubList.length} rail stations loaded`);

function sqDist(a, b) {
  return (a.lat - b.lat) ** 2 + ((a.lon ?? a.lng) - (b.lon ?? b.lng)) ** 2;
}

function encodePolyline(points) {
  let encoded = "";
  let prevLat = 0;
  let prevLng = 0;
  for (const { lat, lon } of points) {
    const latE5 = Math.round(lat * 1e5);
    const lngE5 = Math.round(lon * 1e5);
    encoded += encVal(latE5 - prevLat);
    encoded += encVal(lngE5 - prevLng);
    prevLat = latE5;
    prevLng = lngE5;
  }
  return encoded;
}

function encVal(value) {
  let v = value < 0 ? ~(value << 1) : value << 1;
  let out = "";
  while (v >= 0x20) {
    out += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
    v >>= 5;
  }
  out += String.fromCharCode(v + 63);
  return out;
}

const allSegments = [];
const seenPairs = new Set();
let processed = 0;

for (const rel of relations) {
  const tags = rel.tags || {};
  if (tags.type !== "route" || tags.route !== "train") continue;

  const routeName = tags.name || tags.ref || `Relation ${rel.id}`;
  const operator = tags.operator || null;

  const wayMembers = rel.members.filter(m => m.type === "way");
  const stopMembers = rel.members.filter(
    m => m.type === "node" && (m.role.includes("stop") || m.role === ""),
  );

  if (wayMembers.length === 0 || stopMembers.length < 2) continue;

  // Build route geometry from ordered ways
  const routePoints = [];
  for (const wm of wayMembers) {
    const nodeIds = wayMap.get(wm.ref);
    if (!nodeIds) continue;

    const wayPts = [];
    for (const nid of nodeIds) {
      const nd = nodeMap.get(nid);
      if (nd) wayPts.push({ lat: nd.lat, lon: nd.lon });
    }
    if (wayPts.length === 0) continue;

    if (routePoints.length > 0 && wayPts.length > 0) {
      const last = routePoints[routePoints.length - 1];
      const distFirst = sqDist(last, wayPts[0]);
      const distLast = sqDist(last, wayPts[wayPts.length - 1]);
      if (distLast < distFirst) wayPts.reverse();
      wayPts.shift();
    }
    routePoints.push(...wayPts);
  }

  if (routePoints.length < 2) continue;

  // Match stop nodes to transport hubs by proximity
  const stations = [];
  for (const sm of stopMembers) {
    const nd = nodeMap.get(sm.ref);
    if (!nd) continue;

    let bestHub = null;
    let bestDist = Infinity;
    for (const hub of hubList) {
      const d = (nd.lat - hub.lat) ** 2 + (nd.lon - hub.lng) ** 2;
      if (d < bestDist) { bestDist = d; bestHub = hub; }
    }
    if (!bestHub || bestDist > 0.0001) continue; // ~1km

    let bestIdx = 0;
    let bestPosDist = Infinity;
    for (let i = 0; i < routePoints.length; i++) {
      const d = sqDist(nd, routePoints[i]);
      if (d < bestPosDist) { bestPosDist = d; bestIdx = i; }
    }

    stations.push({ name: bestHub.name, code: bestHub.code, posIdx: bestIdx });
  }

  stations.sort((a, b) => a.posIdx - b.posIdx);
  const unique = stations.filter((s, i) => i === 0 || s.posIdx !== stations[i - 1].posIdx);

  for (let i = 0; i < unique.length - 1; i++) {
    const from = unique[i];
    const to = unique[i + 1];
    if (!from.code || !to.code) continue;
    if (to.posIdx <= from.posIdx) continue;

    const pairKey = `${from.code}:${to.code}`;
    if (seenPairs.has(pairKey)) continue;
    seenPairs.add(pairKey);

    const segPts = routePoints.slice(from.posIdx, to.posIdx + 1);
    if (segPts.length < 2) continue;

    allSegments.push({
      osm_relation_id: rel.id,
      route_name: routeName,
      operator,
      from_station_name: from.name,
      to_station_name: to.name,
      from_station_code: from.code,
      to_station_code: to.code,
      encoded_polyline: encodePolyline(segPts),
      point_count: segPts.length,
    });
  }

  processed++;
  if (processed % 50 === 0) console.log(`Processed ${processed} relations, ${allSegments.length} segments...`);
}

console.log(`\nTotal: ${allSegments.length} segments from ${processed} relations`);

// Check for our critical route
const lei_dby = allSegments.filter(s =>
  (s.from_station_code === "LEI" && s.to_station_code === "DBY") ||
  (s.from_station_code === "DBY" && s.to_station_code === "LEI")
);
console.log(`LEI↔DBY segments:`, lei_dby.map(s => `${s.from_station_code}→${s.to_station_code} (${s.point_count} pts, ${s.route_name})`));

// Clear existing and seed
console.log("\nClearing existing segments...");
await supabase.from("rail_named_route_segments").delete().gte("id", "00000000-0000-0000-0000-000000000000");

console.log("Seeding...");
const BATCH = 50;
let seeded = 0;
for (let i = 0; i < allSegments.length; i += BATCH) {
  const chunk = allSegments.slice(i, i + BATCH);
  const { error } = await supabase.from("rail_named_route_segments").upsert(chunk, {
    onConflict: "from_station_code,to_station_code",
  });
  if (error) {
    console.error(`Error at batch ${i}:`, error.message);
    break;
  }
  seeded += chunk.length;
}

console.log(`Done: ${seeded} segments seeded.`);
