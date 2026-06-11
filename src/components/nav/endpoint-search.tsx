"use client";

import { useEffect, useRef, useState } from "react";
import { searchTransportHubs } from "@/lib/actions/travel-profile";
import { searchPlaces } from "@/lib/actions/place-search";
import { geocodeSearch } from "@/lib/actions/nav";
import { formatMiles } from "@/lib/geo";
import type { NavPoint } from "@/lib/nav/types";

// One search box, every kind of endpoint: current location, transport hubs
// (curated, code-aware), the user's saved places, and free-text OSM geocoding
// (Photon) for everything else — pubs, addresses, venues. Fan-out runs in
// parallel on a 300ms debounce; results are grouped, proximity-labelled when
// we know where the user is, and collapse to a NavPoint on pick.

type Suggestion = {
  group: "station" | "place" | "osm";
  name: string;
  detail: string;
  lat: number;
  lng: number;
  distance_m?: number;
};

export function EndpointSearch({
  label,
  value,
  near,
  allowCurrentLocation = false,
  onPick,
}: {
  label: string;
  value: NavPoint | null;
  near?: { lat: number; lng: number } | null;
  allowCurrentLocation?: boolean;
  onPick: (p: NavPoint | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Suggestion[]>([]);
  const [locating, setLocating] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const mySeq = ++seq.current;
    setBusy(true);
    const t = setTimeout(async () => {
      const nearArg = near ?? undefined;
      const [rail, air, places, osm] = await Promise.all([
        searchTransportHubs({ kind: "rail_station", query: q, near: nearArg }).catch(() => null),
        searchTransportHubs({ kind: "airport", query: q, near: nearArg }).catch(() => null),
        searchPlaces({ query: q, near: nearArg }).catch(() => null),
        geocodeSearch({ query: q, near: nearArg }).catch(() => null),
      ]);
      if (seq.current !== mySeq) return; // stale response

      const hubHits = [...(rail?.ok ? rail.value : []), ...(air?.ok ? air.value.slice(0, 2) : [])];
      const out: Suggestion[] = [];
      {
        for (const h of hubHits.slice(0, 4)) {
          if (h.latitude == null || h.longitude == null) continue;
          out.push({
            group: "station",
            name: h.code ? `${h.name} (${h.code})` : h.name,
            detail: [h.kind === "airport" ? "Airport" : "Station", h.city].filter(Boolean).join(" · "),
            lat: h.latitude,
            lng: h.longitude,
            distance_m: h.distance_m,
          });
        }
      }
      if (places?.ok) {
        for (const p of places.value.slice(0, 3)) {
          if (p.latitude == null || p.longitude == null) continue;
          out.push({
            group: "place",
            name: p.name,
            detail: p.kind === "customer_site" ? "Client site" : "Saved place",
            lat: p.latitude,
            lng: p.longitude,
            distance_m: p.distance_m,
          });
        }
      }
      if (osm?.ok) {
        for (const g of osm.value.slice(0, 5)) {
          out.push({ group: "osm", name: g.name, detail: g.detail, lat: g.lat, lng: g.lng, distance_m: g.distance_m });
        }
      }
      setResults(out);
      setBusy(false);
    }, 300);
    return () => clearTimeout(t);
  }, [query, near]);

  function useCurrentLocation() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setOpen(false);
        setQuery("");
        onPick({ lat: pos.coords.latitude, lng: pos.coords.longitude, name: "Current location" });
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 12_000 },
    );
  }

  if (value) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          padding: "10px 12px",
          border: "1px solid var(--rule)",
          borderRadius: "var(--radius-md)",
          background: "var(--card)",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: "var(--fs-micro)", color: "var(--ink-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {label}
          </div>
          <div style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value.name}</div>
        </div>
        <button
          type="button"
          className="cc-btn"
          onClick={() => {
            onPick(null);
            setOpen(true);
          }}
        >
          Change
        </button>
      </div>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      <div style={{ fontSize: "var(--fs-micro)", color: "var(--ink-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
        {label}
      </div>
      <input
        type="text"
        value={query}
        placeholder="Station, place, address…"
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        style={{
          width: "100%",
          padding: "10px 12px",
          border: "1px solid var(--rule)",
          borderRadius: "var(--radius-md)",
          background: "var(--card)",
          color: "var(--ink)",
          font: "inherit",
        }}
      />
      {open && (allowCurrentLocation || results.length > 0 || busy) ? (
        <div
          style={{
            position: "absolute",
            zIndex: 30,
            top: "100%",
            left: 0,
            right: 0,
            marginTop: 4,
            border: "1px solid var(--rule)",
            borderRadius: "var(--radius-md)",
            background: "var(--card)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            maxHeight: 320,
            overflowY: "auto",
          }}
        >
          {allowCurrentLocation ? (
            <SuggestRow
              name={locating ? "Locating…" : "Current location"}
              detail="Use GPS"
              accent
              onClick={useCurrentLocation}
            />
          ) : null}
          {busy && results.length === 0 ? (
            <div style={{ padding: "10px 12px", color: "var(--ink-dim)", fontSize: "var(--fs-label)" }}>Searching…</div>
          ) : null}
          {results.map((r, i) => (
            <SuggestRow
              key={`${r.group}-${i}`}
              name={r.name}
              detail={[r.detail, r.distance_m != null ? formatMiles(r.distance_m) : null].filter(Boolean).join(" · ")}
              onClick={() => {
                setOpen(false);
                setQuery("");
                onPick({ lat: r.lat, lng: r.lng, name: r.name });
              }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SuggestRow({
  name,
  detail,
  accent = false,
  onClick,
}: {
  name: string;
  detail: string;
  accent?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        padding: "10px 12px",
        background: "none",
        border: "none",
        borderBottom: "1px solid var(--rule)",
        cursor: "pointer",
        color: accent ? "var(--gold-2)" : "var(--ink)",
        font: "inherit",
      }}
    >
      <div style={{ fontWeight: 500 }}>{name}</div>
      {detail ? (
        <div style={{ fontSize: "var(--fs-micro)", color: "var(--ink-dim)", marginTop: 2 }}>{detail}</div>
      ) : null}
    </button>
  );
}
