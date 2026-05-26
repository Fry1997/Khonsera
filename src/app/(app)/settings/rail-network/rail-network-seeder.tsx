"use client";

import { useState, useCallback } from "react";
import {
  seedRailEdges,
  clearRailNetwork,
  getRailNetworkStats,
} from "@/lib/actions/rail-network";

type Stats = { edgeCount: number } | null;

type Status =
  | { phase: "idle" }
  | { phase: "seeding"; regionIndex: number; regionCount: number; edgesSoFar: number; regionLabel: string }
  | { phase: "done"; totalEdges: number }
  | { phase: "error"; message: string }
  | { phase: "clearing" };

// Regional bounding boxes that tile the UK. Overlapping slightly is
// fine — deduplication happens in the edge set via the unique lat/lng
// key of each node. Keeping queries under ~1M elements each.
const REGIONS: Array<{
  label: string;
  south: number;
  west: number;
  north: number;
  east: number;
}> = [
  { label: "South West", south: 50.0, west: -6.0, north: 51.5, east: -2.0 },
  { label: "South Central", south: 50.5, west: -2.0, north: 51.5, east: 0.0 },
  { label: "South East", south: 50.5, west: 0.0, north: 51.5, east: 2.0 },
  { label: "London West", south: 51.2, west: -2.0, north: 52.0, east: -0.2 },
  { label: "London East", south: 51.2, west: -0.3, north: 52.0, east: 1.5 },
  { label: "East Anglia", south: 51.8, west: 0.0, north: 53.0, east: 2.0 },
  { label: "West Midlands", south: 51.8, west: -3.5, north: 53.0, east: -1.0 },
  { label: "East Midlands", south: 51.8, west: -1.5, north: 53.0, east: 0.5 },
  { label: "Wales", south: 51.3, west: -5.5, north: 53.5, east: -2.5 },
  { label: "North West", south: 53.0, west: -3.5, north: 54.5, east: -1.5 },
  { label: "Yorkshire", south: 53.0, west: -2.0, north: 54.5, east: 0.0 },
  { label: "North East", south: 54.5, west: -3.0, north: 55.8, east: 0.0 },
  { label: "Scotland Central", south: 55.5, west: -5.5, north: 56.5, east: -3.0 },
  { label: "Scotland East", south: 55.5, west: -3.5, north: 57.0, east: -1.0 },
  { label: "Scotland North", south: 56.5, west: -6.0, north: 59.0, east: -2.0 },
];

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const BATCH_SIZE = 2000;

type Edge = { from_lat: number; from_lng: number; to_lat: number; to_lng: number };

function buildOverpassQuery(south: number, west: number, north: number, east: number): string {
  return `[out:json][timeout:60];way["railway"="rail"]["service"!~"siding|yard|crossover|spur"](${south},${west},${north},${east});(._;>;);out body;`;
}

function parseOverpassResponse(json: {
  elements?: Array<{
    type: string;
    id: number;
    lat?: number;
    lon?: number;
    nodes?: number[];
  }>;
}): Edge[] {
  const nodes = new Map<number, { lat: number; lng: number }>();
  const ways: Array<{ nodeIds: number[] }> = [];

  for (const el of json.elements ?? []) {
    if (el.type === "node" && el.lat != null && el.lon != null) {
      nodes.set(el.id, { lat: el.lat, lng: el.lon });
    } else if (el.type === "way" && el.nodes) {
      ways.push({ nodeIds: el.nodes });
    }
  }

  const edges: Edge[] = [];
  const seen = new Set<string>();

  for (const way of ways) {
    for (let i = 0; i < way.nodeIds.length - 1; i++) {
      const a = nodes.get(way.nodeIds[i]);
      const b = nodes.get(way.nodeIds[i + 1]);
      if (!a || !b) continue;

      // Deduplicate by rounded coordinate pair key
      const key = `${a.lat.toFixed(5)},${a.lng.toFixed(5)}:${b.lat.toFixed(5)},${b.lng.toFixed(5)}`;
      if (seen.has(key)) continue;
      seen.add(key);

      edges.push({
        from_lat: a.lat,
        from_lng: a.lng,
        to_lat: b.lat,
        to_lng: b.lng,
      });
    }
  }

  return edges;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function RailNetworkSeeder({
  initialStats,
}: {
  initialStats: Stats;
}) {
  const [stats, setStats] = useState<Stats>(initialStats);
  const [status, setStatus] = useState<Status>({ phase: "idle" });

  const handleSeed = useCallback(async () => {
    setStatus({ phase: "seeding", regionIndex: 0, regionCount: REGIONS.length, edgesSoFar: 0, regionLabel: REGIONS[0].label });

    let totalEdges = 0;

    for (let i = 0; i < REGIONS.length; i++) {
      const region = REGIONS[i];
      setStatus({
        phase: "seeding",
        regionIndex: i,
        regionCount: REGIONS.length,
        edgesSoFar: totalEdges,
        regionLabel: region.label,
      });

      try {
        const query = buildOverpassQuery(region.south, region.west, region.north, region.east);
        const resp = await fetch(OVERPASS_URL, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: `data=${encodeURIComponent(query)}`,
          signal: AbortSignal.timeout(60_000),
        });

        if (!resp.ok) {
          setStatus({
            phase: "error",
            message: `Overpass returned HTTP ${resp.status} for ${region.label}. Try again in a minute.`,
          });
          return;
        }

        const json = await resp.json();
        const edges = parseOverpassResponse(json);

        // Batch-insert edges in chunks
        for (let j = 0; j < edges.length; j += BATCH_SIZE) {
          const chunk = edges.slice(j, j + BATCH_SIZE);
          await seedRailEdges(chunk);
          totalEdges += chunk.length;
          setStatus({
            phase: "seeding",
            regionIndex: i,
            regionCount: REGIONS.length,
            edgesSoFar: totalEdges,
            regionLabel: region.label,
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setStatus({
          phase: "error",
          message: `Failed on ${region.label}: ${msg}`,
        });
        return;
      }

      // Be polite to Overpass — wait 3 seconds between region queries
      if (i < REGIONS.length - 1) {
        await sleep(3000);
      }
    }

    // Refresh stats from server
    const fresh = await getRailNetworkStats();
    setStats(fresh);
    setStatus({ phase: "done", totalEdges });
  }, []);

  const handleClear = useCallback(async () => {
    if (!window.confirm("Clear all stored rail edges? You will need to re-seed.")) return;
    setStatus({ phase: "clearing" });
    try {
      await clearRailNetwork();
      setStats(null);
      setStatus({ phase: "idle" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatus({ phase: "error", message: `Clear failed: ${msg}` });
    }
  }, []);

  const isWorking = status.phase === "seeding" || status.phase === "clearing";

  return (
    <div className="j-card p-6" style={{ maxWidth: 640 }}>
      <h2 className="h3 mb-2">UK Rail Network Graph</h2>
      <p className="small mb-4" style={{ color: "var(--ink-dim)" }}>
        Downloads railway track geometry from OpenStreetMap via the Overpass API.
        This must run from your browser (Overpass blocks cloud IPs). Once seeded,
        rail route polylines are generated server-side without hitting Overpass again.
      </p>

      {/* Status indicator */}
      <div
        className="mb-4"
        style={{
          padding: "10px 14px",
          borderRadius: 6,
          fontSize: 13,
          background: stats ? "var(--sage-2)" : "var(--card-2)",
          border: `1px solid ${stats ? "var(--sage-2)" : "var(--rule-2)"}`,
          color: stats ? "var(--sage)" : "var(--ink-dim)",
        }}
      >
        {stats
          ? `Seeded: ${stats.edgeCount.toLocaleString()} edges stored`
          : "Not seeded yet"}
      </div>

      {/* Progress during seeding */}
      {status.phase === "seeding" && (
        <div
          className="mb-4"
          style={{
            padding: "10px 14px",
            borderRadius: 6,
            fontSize: 13,
            background: "var(--gold-2)",
            border: "1px solid var(--gold-2)",
            color: "var(--ink)",
          }}
        >
          <div style={{ marginBottom: 4 }}>
            Region {status.regionIndex + 1}/{status.regionCount}: {status.regionLabel}
          </div>
          <div className="mono" style={{ fontSize: 12 }}>
            {status.edgesSoFar.toLocaleString()} edges stored so far
          </div>
          {/* Simple progress bar */}
          <div
            style={{
              marginTop: 8,
              height: 4,
              borderRadius: 2,
              background: "var(--rule-2)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                borderRadius: 2,
                background: "var(--gold)",
                width: `${((status.regionIndex + 1) / status.regionCount) * 100}%`,
                transition: "width 0.3s ease",
              }}
            />
          </div>
        </div>
      )}

      {/* Error message */}
      {status.phase === "error" && (
        <div
          className="mb-4"
          style={{
            padding: "10px 14px",
            borderRadius: 6,
            fontSize: 13,
            background: "var(--rust-2)",
            border: "1px solid var(--rust-2)",
            color: "var(--rust)",
          }}
        >
          {status.message}
        </div>
      )}

      {/* Done message */}
      {status.phase === "done" && (
        <div
          className="mb-4"
          style={{
            padding: "10px 14px",
            borderRadius: 6,
            fontSize: 13,
            background: "var(--sage-2)",
            border: "1px solid var(--sage-2)",
            color: "var(--sage)",
          }}
        >
          Done -- {status.totalEdges.toLocaleString()} edges stored.
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 10 }}>
        <button
          type="button"
          className="btn-primary"
          onClick={handleSeed}
          disabled={isWorking}
        >
          {isWorking
            ? "Working..."
            : stats
              ? "Re-seed network"
              : "Seed UK Rail Network"}
        </button>
        {stats && (
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
