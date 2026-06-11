"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchNavRoute } from "@/lib/actions/nav";
import { formatNavDistance, formatNavDuration } from "@/lib/nav/guidance";
import { tilesForCorridor, MANEUVER_ZOOM } from "@/lib/nav/tiles";
import {
  saveNavRoute,
  listNavRoutes,
  deleteNavRoute,
  prefetchTiles,
} from "@/lib/offline/nav-cache";
import type { NavMode, NavPoint, NavRoute, SavedNavRoute, ManeuverKind } from "@/lib/nav/types";
import { EndpointSearch } from "./endpoint-search";
import { NavMap } from "./nav-map";
import { useGuidance, type GuidanceFix } from "./use-guidance";

// The Navigate surface — point-to-point door navigation on the open stack
// (Valhalla routing, Photon geocoding, OSM/MapLibre rendering). Three states:
//   plan     — pick endpoints + mode, fetch the route, read the maneuvers
//   guidance — live GPS dot, next-instruction card, voice, auto re-route
// Saved routes (route JSON + corridor tiles, IndexedDB) make both work with
// zero signal — the platform scenario this exists for.

const MODES: { id: NavMode; label: string }[] = [
  { id: "walk", label: "Walk" },
  { id: "cycle", label: "Cycle" },
  { id: "drive", label: "Drive" },
];

export function NavigateScreen({
  initialDestination,
}: {
  initialDestination?: NavPoint | null;
}) {
  const [origin, setOrigin] = useState<NavPoint | null>(null);
  const [destination, setDestination] = useState<NavPoint | null>(initialDestination ?? null);
  const [mode, setMode] = useState<NavMode>("walk");
  const [route, setRoute] = useState<NavRoute | null>(null);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [guiding, setGuiding] = useState(false);
  const [voice, setVoice] = useState(true);

  const [saved, setSaved] = useState<SavedNavRoute[]>([]);
  const [saving, setSaving] = useState<{ done: number; total: number } | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);

  useEffect(() => {
    void listNavRoutes().then(setSaved);
  }, []);

  const getRoute = useCallback(
    async (o: NavPoint, d: NavPoint, m: NavMode) => {
      setFetching(true);
      setError(null);
      const res = await fetchNavRoute({ origin: o, destination: d, mode: m });
      setFetching(false);
      if (res.ok) {
        setRoute(res.value);
      } else {
        setError(
          res.error.kind === "integration"
            ? "Couldn't reach the routing service. If you saved this route earlier, open it from Saved routes below."
            : "Couldn't plan that route.",
        );
      }
    },
    [],
  );

  // Fetch / refetch whenever both endpoints + mode are set.
  useEffect(() => {
    if (origin && destination) void getRoute(origin, destination, mode);
    else setRoute(null);
  }, [origin, destination, mode, getRoute]);

  const onReroute = useCallback(
    (from: GuidanceFix) => {
      if (!destination) return;
      const newOrigin: NavPoint = { lat: from.lat, lng: from.lng, name: "Current location" };
      setOrigin(newOrigin);
      // The endpoint effect refetches; guidance state resets on new route.
    },
    [destination],
  );

  const { fix, state, geoError } = useGuidance(route, guiding, { voice, onReroute });

  async function saveForOffline() {
    if (!route) return;
    const id = crypto.randomUUID();
    const maneuverPoints = route.maneuvers
      .map((m) => route.geometry[Math.min(m.begin_shape_index, route.geometry.length - 1)])
      .filter(Boolean);
    const tiles = tilesForCorridor(route.geometry, {
      detailPoints: maneuverPoints,
      detailZoom: MANEUVER_ZOOM,
    });
    setSaving({ done: 0, total: tiles.length });
    const stored = await prefetchTiles(tiles, id, (done, total) => setSaving({ done, total }));
    await saveNavRoute({
      id,
      label: `${route.origin.name} → ${route.destination.name}`,
      route,
      saved_at: new Date().toISOString(),
      tile_count: stored,
    });
    setSaving(null);
    setSavedNote(`Saved with ${stored} map tiles — this route now works without signal.`);
    setSaved(await listNavRoutes());
  }

  function openSaved(s: SavedNavRoute) {
    setOrigin(s.route.origin);
    setDestination(s.route.destination);
    setMode(s.route.mode);
    setRoute(s.route); // show immediately; the effect may refresh it online
    setSavedNote(null);
  }

  async function removeSaved(s: SavedNavRoute) {
    if (!window.confirm(`Remove the saved route to ${s.route.destination.name}? Its offline map tiles clear too.`)) return;
    await deleteNavRoute(s.id);
    setSaved(await listNavRoutes());
  }

  // ── Guidance mode — full-bleed map + instruction card ──────────────
  if (guiding && route) {
    const maneuver = state ? route.maneuvers[state.maneuver_index] : null;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "var(--space-3)",
            padding: "var(--space-4)",
            background: "var(--card)",
            border: "1px solid var(--rule)",
            borderRadius: "var(--radius-lg)",
          }}
        >
          <ManeuverGlyph kind={maneuver?.kind ?? "straight"} size={34} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-h2)", lineHeight: "var(--lh-h2)" }}>
              {state ? formatNavDistance(state.to_maneuver_m) : "…"}
            </div>
            <div style={{ marginTop: 2 }}>{maneuver?.instruction ?? "Waiting for a location fix…"}</div>
            {state && state.off_route_m > 50 ? (
              <div style={{ marginTop: 4, fontSize: "var(--fs-label)", color: "var(--gold-2)" }}>
                Off the line by {formatNavDistance(state.off_route_m)} — rejoining or re-routing.
              </div>
            ) : null}
            {geoError ? (
              <div style={{ marginTop: 4, fontSize: "var(--fs-label)", color: "var(--ink-dim)" }}>{geoError}</div>
            ) : null}
          </div>
        </div>

        <NavMap route={route} position={fix} follow height={420} />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "var(--space-3)",
          }}
        >
          <div style={{ fontSize: "var(--fs-label)", color: "var(--ink-dim)" }}>
            {state
              ? state.arrived
                ? "You have arrived."
                : `${formatNavDistance(state.remaining_m)} · ${formatNavDuration(state.remaining_s)} remaining`
              : "Acquiring GPS…"}
          </div>
          <div style={{ display: "flex", gap: "var(--space-2)" }}>
            <button type="button" className="cc-btn" onClick={() => setVoice((v) => !v)}>
              {voice ? "Mute voice" : "Voice on"}
            </button>
            <button type="button" className="cc-btn cc-btn-gold" onClick={() => setGuiding(false)}>
              End
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Plan mode ───────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
        <EndpointSearch
          label="From"
          value={origin}
          near={destination}
          allowCurrentLocation
          onPick={setOrigin}
        />
        <EndpointSearch label="To" value={destination} near={origin} onPick={setDestination} />
      </div>

      <div style={{ display: "flex", gap: "var(--space-2)" }}>
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            className={mode === m.id ? "cc-btn cc-btn-gold" : "cc-btn"}
            onClick={() => setMode(m.id)}
          >
            {m.label}
          </button>
        ))}
      </div>

      {fetching ? <p className="cc-at-sub">Plotting the way…</p> : null}
      {error ? <p style={{ color: "var(--gold-2)", fontSize: "var(--fs-label)" }}>{error}</p> : null}

      {route ? (
        <>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              gap: "var(--space-3)",
            }}
          >
            <div>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-h2)" }}>
                {formatNavDuration(route.duration_s)}
              </span>
              <span style={{ marginLeft: 8, color: "var(--ink-dim)" }}>{formatNavDistance(route.distance_m)}</span>
            </div>
            <div style={{ display: "flex", gap: "var(--space-2)" }}>
              <button type="button" className="cc-btn" onClick={saveForOffline} disabled={!!saving}>
                {saving ? `Saving ${saving.done}/${saving.total}…` : "Save offline"}
              </button>
              <button type="button" className="cc-btn cc-btn-gold" onClick={() => setGuiding(true)}>
                Start
              </button>
            </div>
          </div>
          {savedNote ? (
            <p style={{ fontSize: "var(--fs-label)", color: "var(--ink-dim)" }}>{savedNote}</p>
          ) : null}

          <NavMap route={route} position={fix} height={360} />

          <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {route.maneuvers.map((m, i) => (
              <li
                key={i}
                style={{
                  display: "flex",
                  gap: "var(--space-3)",
                  alignItems: "flex-start",
                  padding: "var(--space-3) 0",
                  borderBottom: "1px solid var(--rule)",
                }}
              >
                <ManeuverGlyph kind={m.kind} size={20} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div>{m.instruction}</div>
                  {m.distance_m > 0 ? (
                    <div style={{ fontSize: "var(--fs-micro)", color: "var(--ink-dim)", marginTop: 2 }}>
                      {formatNavDistance(m.distance_m)}
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        </>
      ) : null}

      {saved.length > 0 ? (
        <section>
          <h2 className="cc-eyebrow" style={{ marginBottom: "var(--space-2)" }}>
            Saved routes
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            {saved.map((s) => (
              <div
                key={s.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "var(--space-2)",
                  padding: "10px 12px",
                  border: "1px solid var(--rule)",
                  borderRadius: "var(--radius-md)",
                  background: "var(--card)",
                }}
              >
                <button
                  type="button"
                  onClick={() => openSaved(s)}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    textAlign: "left",
                    cursor: "pointer",
                    color: "var(--ink)",
                    font: "inherit",
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  <div style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {s.label}
                  </div>
                  <div style={{ fontSize: "var(--fs-micro)", color: "var(--ink-dim)", marginTop: 2 }}>
                    {MODES.find((m) => m.id === s.route.mode)?.label} · {formatNavDistance(s.route.distance_m)} ·{" "}
                    {s.tile_count > 0 ? "offline map saved" : "route only"}
                  </div>
                </button>
                <button type="button" className="cc-btn" onClick={() => removeSaved(s)} aria-label="Remove saved route">
                  Remove
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

// Minimal stroke glyphs for the maneuver vocabulary — same 24-box style as the
// shell tab icons. No emojis, ever.
const GLYPH_PATHS: Record<ManeuverKind, string> = {
  depart: "M12 20 V6 M7 11 l5-5 5 5",
  arrive: "M12 4 a4 4 0 0 1 4 4 c0 3-4 8-4 8 s-4-5-4-8 a4 4 0 0 1 4-4 z M12 8 h.01",
  straight: "M12 20 V6 M7 11 l5-5 5 5",
  "slight-left": "M14 20 V12 L9 7 M9 12 V7 h5",
  left: "M16 20 V10 H7 M11 5 l-5 5 5 5",
  "sharp-left": "M16 20 V9 L8 16 M8 9 v7 M8 16 h7",
  "slight-right": "M10 20 V12 L15 7 M15 12 V7 h-5",
  right: "M8 20 V10 H17 M13 5 l5 5-5 5",
  "sharp-right": "M8 20 V9 L16 16 M16 9 v7 M16 16 H9",
  uturn: "M8 20 V10 a4 4 0 0 1 8 0 v3 M12 9 l4 4 4-4",
  merge: "M7 20 c0-6 5-7 5-12 M17 20 c0-6-5-7-5-12 M12 4 l-3 4 M12 4 l3 4",
  roundabout: "M12 16 a4 4 0 1 1 0-8 a4 4 0 0 1 0 8 z M12 20 v-4 M12 8 V4 M9 5 l3-1 3 1",
  "exit-roundabout": "M10 16 a4 4 0 1 1 2-7.5 M16 20 v-6 h-6 M16 14 l-2 2 M16 14 l2 2",
  ferry: "M4 18 c2 2 4 0 6 0 s4 2 6 0 s3 1 4 0 M6 14 l1-5 h10 l1 5 M10 9 V6 h4 v3",
  stairs: "M5 19 h4 v-4 h4 v-4 h4 V7 h2",
  other: "M12 19 h.01 M12 15 a3 3 0 1 0-3-3",
};

function ManeuverGlyph({ kind, size = 20 }: { kind: ManeuverKind; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--gold-2)"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={{ flexShrink: 0, marginTop: 1 }}
    >
      <path d={GLYPH_PATHS[kind] ?? GLYPH_PATHS.other} />
    </svg>
  );
}
