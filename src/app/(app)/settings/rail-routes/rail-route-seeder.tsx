"use client";

import { useState, useCallback } from "react";
import {
  seedRouteSegments,
  clearRouteSegments,
  getRouteSegmentStats,
  getAllRailStationCodes,
  type RouteSegment,
} from "@/lib/actions/rail-network";

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const BATCH_SIZE = 50;

type Status =
  | { phase: "idle" }
  | { phase: "fetching"; region: string; regionIdx: number }
  | { phase: "processing"; message: string }
  | { phase: "seeding"; seeded: number; total: number }
  | { phase: "done"; total: number }
  | { phase: "error"; message: string };

type OsmNode = { type: "node"; id: number; lat: number; lon: number; tags?: Record<string, string> };
type OsmWay = { type: "way"; id: number; nodes: number[] };
type OsmRelation = {
  type: "relation";
  id: number;
  tags?: Record<string, string>;
  members: Array<{ type: string; ref: number; role: string }>;
};

export function RailRouteSeeder({ initialCount }: { initialCount: number }) {
  const [count, setCount] = useState(initialCount);
  const [status, setStatus] = useState<Status>({ phase: "idle" });

  const handleSeed = useCallback(async () => {
    setStatus({ phase: "fetching", region: "United Kingdom", regionIdx: 0 });

    try {
      const allNodes = new Map<number, { lat: number; lon: number; tags?: Record<string, string> }>();
      const allWays = new Map<number, number[]>();
      const allRelations: OsmRelation[] = [];

      const query = `[out:json][timeout:300];area["ISO3166-1"="GB"]->.uk;(relation(area.uk)["type"="route"]["route"="train"];);out body;>;out skel qt;`;
      const resp = await fetch(OVERPASS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(300_000),
      });

      if (!resp.ok) {
        setStatus({ phase: "error", message: `Overpass HTTP ${resp.status}. Wait a minute and retry.` });
        return;
      }

      setStatus({ phase: "processing", message: "Parsing response..." });
      const json = await resp.json();

      for (const el of json.elements ?? []) {
        if (el.type === "node" && el.lat != null && el.lon != null) {
          allNodes.set(el.id, { lat: el.lat, lon: el.lon, tags: el.tags });
        } else if (el.type === "way" && el.nodes) {
          allWays.set(el.id, el.nodes);
        } else if (el.type === "relation") {
          allRelations.push(el as OsmRelation);
        }
      }

      setStatus({ phase: "processing", message: `${allNodes.size} nodes, ${allWays.size} ways, ${allRelations.length} relations. Loading station database...` });

      const hubList = await getAllRailStationCodes();
      setStatus({ phase: "processing", message: `${hubList.length} stations loaded. Building route segments from ${allRelations.length} relations...` });

      const allSegments: RouteSegment[] = [];
      const seenPairs = new Set<string>();

      for (const rel of allRelations) {
        const tags = rel.tags ?? {};
        if (tags.type !== "route" || tags.route !== "train") continue;

        const routeName = tags.name ?? tags.ref ?? `Relation ${rel.id}`;
        const operator = tags.operator ?? null;

        const wayMembers = rel.members.filter((m) => m.type === "way");
        const stopMembers = rel.members.filter(
          (m) => m.type === "node" && m.role.includes("stop"),
        );

        if (wayMembers.length === 0 || stopMembers.length < 2) continue;

        const routePoints: Array<{ lat: number; lon: number }> = [];
        for (const wm of wayMembers) {
          const nodeIds = allWays.get(wm.ref);
          if (!nodeIds) continue;

          const wayPts: Array<{ lat: number; lon: number }> = [];
          for (const nid of nodeIds) {
            const nd = allNodes.get(nid);
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

        const stations: Array<{ name: string; code: string | null; posIdx: number }> = [];
        for (const sm of stopMembers) {
          const nd = allNodes.get(sm.ref);
          if (!nd) continue;

          // Match stop to nearest transport hub by coordinates (within 1km)
          let bestHub: { code: string; name: string } | null = null;
          let bestHubDist = Infinity;
          for (const hub of hubList) {
            const d = sqDist(nd, { lat: hub.lat, lon: hub.lng });
            if (d < bestHubDist) { bestHubDist = d; bestHub = hub; }
          }
          // ~0.01 degrees ≈ 1km — skip if no hub nearby
          if (!bestHub || bestHubDist > 0.0001) continue;

          let bestIdx = 0;
          let bestDist = Infinity;
          for (let i = 0; i < routePoints.length; i++) {
            const d = sqDist(nd, routePoints[i]);
            if (d < bestDist) { bestDist = d; bestIdx = i; }
          }

          stations.push({ name: bestHub.name, code: bestHub.code, posIdx: bestIdx });
        }

        stations.sort((a, b) => a.posIdx - b.posIdx);
        const unique = stations.filter(
          (s, i) => i === 0 || s.posIdx !== stations[i - 1].posIdx,
        );

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
      }

      if (allSegments.length === 0) {
        setStatus({ phase: "error", message: "No segments with matched station codes found." });
        return;
      }

      setStatus({ phase: "seeding", seeded: 0, total: allSegments.length });

      let seeded = 0;
      for (let i = 0; i < allSegments.length; i += BATCH_SIZE) {
        const chunk = allSegments.slice(i, i + BATCH_SIZE);
        await seedRouteSegments(chunk);
        seeded += chunk.length;
        setStatus({ phase: "seeding", seeded, total: allSegments.length });
      }

      const fresh = await getRouteSegmentStats();
      setCount(fresh?.count ?? seeded);
      setStatus({ phase: "done", total: seeded });
    } catch (err) {
      setStatus({ phase: "error", message: err instanceof Error ? err.message : String(err) });
    }
  }, []);

  const handleClear = useCallback(async () => {
    if (!window.confirm("Clear all stored route segments?")) return;
    try {
      await clearRouteSegments();
      setCount(0);
      setStatus({ phase: "idle" });
    } catch (err) {
      setStatus({ phase: "error", message: err instanceof Error ? err.message : String(err) });
    }
  }, []);

  const isWorking = status.phase === "fetching" || status.phase === "processing" || status.phase === "seeding";

  return (
    <div className="j-card p-6" style={{ maxWidth: 640 }}>
      <h2 className="h3 mb-2">OSM Route Relations</h2>
      <p className="small mb-4" style={{ color: "var(--ink-dim)" }}>
        Fetches named train route relations from OpenStreetMap via Overpass.
        Each relation defines which track segments belong to a specific railway
        line. Station-to-station polylines are extracted and stored — no
        algorithmic routing needed, no junction ambiguity.
      </p>

      <div
        className="mb-4"
        style={{
          padding: "10px 14px",
          borderRadius: 6,
          fontSize: 13,
          background: count > 0 ? "var(--sage-2)" : "var(--card-2)",
          border: `1px solid ${count > 0 ? "var(--sage-2)" : "var(--rule-2)"}`,
          color: count > 0 ? "var(--sage)" : "var(--ink-dim)",
        }}
      >
        {count > 0 ? `${count.toLocaleString()} route segments stored` : "Not seeded yet"}
      </div>

      {status.phase === "fetching" && (
        <ProgressBox color="gold">
          Fetching all UK train route relations from Overpass...
        </ProgressBox>
      )}

      {status.phase === "processing" && (
        <ProgressBox color="gold">{status.message}</ProgressBox>
      )}

      {status.phase === "seeding" && (
        <ProgressBox color="gold">
          Seeding {status.seeded.toLocaleString()}/{status.total.toLocaleString()} segments
          <ProgressBar value={status.seeded / status.total} />
        </ProgressBox>
      )}

      {status.phase === "done" && (
        <ProgressBox color="sage">
          Done -- {status.total.toLocaleString()} route segments stored.
        </ProgressBox>
      )}

      {status.phase === "error" && (
        <ProgressBox color="rust">{status.message}</ProgressBox>
      )}

      <div style={{ display: "flex", gap: 10 }}>
        <button
          type="button"
          className="btn-primary"
          onClick={handleSeed}
          disabled={isWorking}
        >
          {isWorking ? "Working..." : count > 0 ? "Re-seed routes" : "Seed Route Relations"}
        </button>
        {count > 0 && (
          <button
            type="button"
            className="btn-ghost"
            onClick={handleClear}
            disabled={isWorking}
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

function ProgressBox({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <div
      className="mb-4"
      style={{
        padding: "10px 14px",
        borderRadius: 6,
        fontSize: 13,
        background: `var(--${color}-2)`,
        border: `1px solid var(--${color}-2)`,
        color: color === "rust" ? "var(--rust)" : "var(--ink)",
      }}
    >
      {children}
    </div>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div style={{ marginTop: 8, height: 4, borderRadius: 2, background: "var(--rule-2)", overflow: "hidden" }}>
      <div style={{ height: "100%", borderRadius: 2, background: "var(--gold)", width: `${value * 100}%`, transition: "width 0.3s ease" }} />
    </div>
  );
}

function sqDist(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  return (a.lat - b.lat) ** 2 + (a.lon - b.lon) ** 2;
}

function encodePolyline(points: Array<{ lat: number; lon: number }>): string {
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

function encVal(value: number): string {
  let v = value < 0 ? ~(value << 1) : value << 1;
  let out = "";
  while (v >= 0x20) {
    out += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
    v >>= 5;
  }
  out += String.fromCharCode(v + 63);
  return out;
}
