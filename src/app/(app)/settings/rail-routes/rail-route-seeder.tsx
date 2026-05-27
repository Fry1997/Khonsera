"use client";

import { useState, useRef } from "react";
import { seedRouteSegments, clearRouteSegments, getAllRailStationCodes, type RouteSegment } from "@/lib/actions/rail-network";

type OsmNode = { type: "node"; id: number; lat: number; lon: number; tags?: Record<string, string> };
type OsmWay = { type: "way"; id: number; nodes: number[]; tags?: Record<string, string> };
type OsmRelation = {
  type: "relation";
  id: number;
  tags?: Record<string, string>;
  members: Array<{ type: string; ref: number; role: string }>;
};
type OsmElement = OsmNode | OsmWay | OsmRelation;

type StationMatch = {
  osmNodeId: number;
  name: string;
  code: string | null;
  lat: number;
  lon: number;
  positionOnRoute: number;
};

export function RailRouteSeeder({ initialCount }: { initialCount: number }) {
  const [status, setStatus] = useState<string>(
    initialCount > 0 ? `${initialCount} route segments stored` : "No route segments yet",
  );
  const [processing, setProcessing] = useState(false);
  const [segments, setSegments] = useState<RouteSegment[]>([]);
  const [seeded, setSeeded] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProcessing(true);
    setStatus("Reading file...");

    try {
      const text = await file.text();
      setStatus("Parsing JSON...");
      const data = JSON.parse(text) as { elements: OsmElement[] };

      const nodeMap = new Map<number, { lat: number; lon: number }>();
      const wayMap = new Map<number, number[]>();
      const relations: OsmRelation[] = [];

      for (const el of data.elements) {
        if (el.type === "node") nodeMap.set(el.id, { lat: el.lat, lon: el.lon });
        else if (el.type === "way") wayMap.set(el.id, el.nodes);
        else if (el.type === "relation") relations.push(el);
      }

      setStatus(`Parsed ${nodeMap.size} nodes, ${wayMap.size} ways, ${relations.length} relations. Processing routes...`);

      const allSegments: RouteSegment[] = [];
      let processed = 0;

      for (const rel of relations) {
        const tags = rel.tags ?? {};
        if (tags.type !== "route" || tags.route !== "train") continue;

        const routeName = tags.name ?? tags.ref ?? `Relation ${rel.id}`;
        const operator = tags.operator ?? null;

        const wayMembers = rel.members.filter((m) => m.type === "way");
        const stopMembers = rel.members.filter(
          (m) => m.type === "node" && (m.role.includes("stop") || m.role === ""),
        );

        if (wayMembers.length === 0) continue;

        const routePoints: Array<{ lat: number; lon: number }> = [];
        const usedWayIds = new Set<number>();

        for (const wm of wayMembers) {
          const nodeIds = wayMap.get(wm.ref);
          if (!nodeIds) continue;
          if (usedWayIds.has(wm.ref)) continue;
          usedWayIds.add(wm.ref);

          const wayPts: Array<{ lat: number; lon: number }> = [];
          for (const nid of nodeIds) {
            const nd = nodeMap.get(nid);
            if (nd) wayPts.push(nd);
          }
          if (wayPts.length === 0) continue;

          if (routePoints.length > 0 && wayPts.length > 0) {
            const last = routePoints[routePoints.length - 1];
            const distToFirst = sqDist(last, wayPts[0]);
            const distToLast = sqDist(last, wayPts[wayPts.length - 1]);
            if (distToLast < distToFirst) wayPts.reverse();
            wayPts.shift();
          }
          routePoints.push(...wayPts);
        }

        if (routePoints.length < 2) continue;

        const stations: StationMatch[] = [];
        for (const sm of stopMembers) {
          const nd = nodeMap.get(sm.ref);
          if (!nd) continue;
          const nodeTags = data.elements.find(
            (el) => el.type === "node" && el.id === sm.ref,
          ) as OsmNode | undefined;
          const name = nodeTags?.tags?.name ?? `Node ${sm.ref}`;

          let bestIdx = 0;
          let bestDist = Infinity;
          for (let i = 0; i < routePoints.length; i++) {
            const d = sqDist(nd, routePoints[i]);
            if (d < bestDist) { bestDist = d; bestIdx = i; }
          }

          stations.push({
            osmNodeId: sm.ref,
            name,
            code: null,
            lat: nd.lat,
            lon: nd.lon,
            positionOnRoute: bestIdx,
          });
        }

        stations.sort((a, b) => a.positionOnRoute - b.positionOnRoute);
        const uniqueStations = stations.filter(
          (s, i) => i === 0 || s.positionOnRoute !== stations[i - 1].positionOnRoute,
        );

        if (uniqueStations.length < 2) continue;

        for (let i = 0; i < uniqueStations.length - 1; i++) {
          const from = uniqueStations[i];
          const to = uniqueStations[i + 1];
          const startIdx = from.positionOnRoute;
          const endIdx = to.positionOnRoute;
          if (endIdx <= startIdx) continue;

          const segPts = routePoints.slice(startIdx, endIdx + 1);
          if (segPts.length < 2) continue;

          const encoded = googleEncodePolyline(segPts);
          allSegments.push({
            osm_relation_id: rel.id,
            route_name: routeName,
            operator,
            from_station_name: from.name,
            to_station_name: to.name,
            from_station_code: null,
            to_station_code: null,
            encoded_polyline: encoded,
            point_count: segPts.length,
          });
        }

        processed++;
        if (processed % 10 === 0) {
          setStatus(`Processed ${processed}/${relations.length} relations, ${allSegments.length} segments...`);
        }
      }

      setStatus(`Resolving station codes for ${allSegments.length} segments...`);

      const rawMap = await getAllRailStationCodes() as unknown as Record<string, string>;
      const nameToCode = new Map<string, string>(Object.entries(rawMap));

      for (const seg of allSegments) {
        seg.from_station_code = nameToCode.get(seg.from_station_name.toLowerCase()) ?? null;
        seg.to_station_code = nameToCode.get(seg.to_station_name.toLowerCase()) ?? null;
      }

      const withCodes = allSegments.filter((s) => s.from_station_code && s.to_station_code);
      setSegments(withCodes);
      setStatus(`Ready: ${withCodes.length} segments with station codes (${allSegments.length - withCodes.length} skipped — no code match). Click Seed to store.`);
    } catch (err) {
      setStatus(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleSeed = async () => {
    if (segments.length === 0) return;
    setProcessing(true);
    setSeeded(0);

    const chunkSize = 50;
    let total = 0;
    for (let i = 0; i < segments.length; i += chunkSize) {
      const chunk = segments.slice(i, i + chunkSize);
      try {
        const result = await seedRouteSegments(chunk);
        total += result.inserted;
        setSeeded(total);
        setStatus(`Seeded ${total}/${segments.length}...`);
      } catch (err) {
        setStatus(`Error at chunk ${i}: ${err instanceof Error ? err.message : String(err)}`);
        break;
      }
    }

    setStatus(`Done: ${total} route segments stored.`);
    setProcessing(false);
  };

  const handleClear = async () => {
    setProcessing(true);
    try {
      await clearRouteSegments();
      setStatus("Cleared all route segments.");
      setSegments([]);
      setSeeded(0);
    } catch (err) {
      setStatus(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }
    setProcessing(false);
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="small" style={{ color: "var(--ink-dim)" }}>{status}</p>

      <div className="flex gap-3 flex-wrap">
        <label
          className="btn-ghost"
          style={{ cursor: processing ? "wait" : "pointer", fontSize: 13 }}
        >
          Upload Overpass JSON
          <input
            ref={fileRef}
            type="file"
            accept=".json"
            onChange={handleFile}
            disabled={processing}
            style={{ display: "none" }}
          />
        </label>

        {segments.length > 0 && (
          <button
            className="btn-primary"
            onClick={handleSeed}
            disabled={processing}
            style={{ fontSize: 13 }}
          >
            Seed {segments.length} segments
          </button>
        )}

        <button
          className="btn-ghost"
          onClick={handleClear}
          disabled={processing}
          style={{ fontSize: 13, color: "var(--rust)" }}
        >
          Clear all
        </button>
      </div>

      {segments.length > 0 && (
        <div style={{ maxHeight: 300, overflow: "auto", fontSize: 12, color: "var(--ink-dim)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--rule)" }}>
                <th style={{ padding: "4px 8px" }}>From</th>
                <th style={{ padding: "4px 8px" }}>To</th>
                <th style={{ padding: "4px 8px" }}>Route</th>
                <th style={{ padding: "4px 8px" }}>Points</th>
              </tr>
            </thead>
            <tbody>
              {segments.slice(0, 100).map((s, i) => (
                <tr key={i} style={{ borderBottom: "1px solid var(--rule-2)" }}>
                  <td style={{ padding: "3px 8px" }}>{s.from_station_code} {s.from_station_name}</td>
                  <td style={{ padding: "3px 8px" }}>{s.to_station_code} {s.to_station_name}</td>
                  <td style={{ padding: "3px 8px" }}>{s.route_name}</td>
                  <td style={{ padding: "3px 8px" }}>{s.point_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function sqDist(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  return (a.lat - b.lat) ** 2 + (a.lon - b.lon) ** 2;
}

function googleEncodePolyline(points: Array<{ lat: number; lon: number }>): string {
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
