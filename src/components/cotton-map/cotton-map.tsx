"use client";

// CottonMap — Khonsera's day map as an abstract "material map" (Design v8,
// "v7 cotton"). The whole map is one cotton stock; features are distinguished
// only by how they're pressed into the surface (debossed / raised / engraved).
// NO colour, NO tile basemap, NO MapLibre — pure inline SVG, so it renders
// identically on any device, offline, at any size. The journey is a channel
// pressed into the field; charcoal is reserved for stops, home and the live
// you-marker.
//
// The decorative fabric (contours, water, roads, rail, paths, buildings) is
// fixed texture — it does not represent real geography. The REAL data is the
// journey channel + nodes, projected from the journey's coordinates, and the
// live position. (See docs/design + the v8 handoff.)
import { useMemo } from "react";
import type { Journey, LatLng } from "@/components/journey-map";

// Cotton material values — lifted verbatim from the v8 reference. These are
// map-internal material tones (the journey-map themes are already an intentional
// literal-values holder per docs/design-tokens.md), so they live here as-is.
const C = {
  land: "#e8e3d8",
  landLo: "#ddd8cb",
  channel: "#e1dccf",
  water: "#dcdbd2",
  widget: "#fbfaf6",
  well: "#ebe7dd",
  char: "#1f2228",
  ink: "#20242b",
  contour: "rgba(40,44,52,0.09)",
  contourHi: "rgba(255,254,248,0.55)",
  label: "#4a4e56",
  labelFaint: "#6a6e76",
};

const VB_W = 330;
const VB_H = 500;
const PAD_X = 48;
const PAD_Y = 76;

export type LivePosition = { lat: number; lng: number; bearing?: number };

type PT = { x: number; y: number };
type NodeVM = { x: number; y: number; role: "origin" | "mid" | "dest"; label: string };

function keyOf(s: { lat: number; lng: number }): string {
  return `${s.lat.toFixed(4)},${s.lng.toFixed(4)}`;
}

function pathFromPoints(pts: PT[]): string {
  if (pts.length === 0) return "";
  return "M" + pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" L");
}

export function CottonMap({
  journey,
  position,
  className,
}: {
  journey: Journey;
  position?: LivePosition | null;
  className?: string;
}) {
  // One projection from journey coords → the 330×500 viewBox, fit with padding.
  const project = useMemo(() => {
    const lls: LatLng[] = [];
    for (const leg of journey.legs) {
      lls.push([leg.from.lat, leg.from.lng], [leg.to.lat, leg.to.lng]);
      for (const t of leg.track) lls.push(t);
    }
    if (position) lls.push([position.lat, position.lng]);
    if (lls.length === 0) {
      return (_lat: number, _lng: number): PT => ({ x: VB_W / 2, y: VB_H / 2 });
    }
    let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
    for (const [lat, lng] of lls) {
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
    }
    const meanLat = (minLat + maxLat) / 2;
    const kx = Math.cos((meanLat * Math.PI) / 180) || 1; // lng compression at this latitude
    const wMinX = minLng * kx;
    const wMinY = -maxLat; // north up → invert lat
    const wW = Math.max(1e-6, maxLng * kx - wMinX);
    const wH = Math.max(1e-6, -minLat - wMinY);
    const innerW = VB_W - 2 * PAD_X;
    const innerH = VB_H - 2 * PAD_Y;
    const s = Math.min(innerW / wW, innerH / wH);
    const offX = PAD_X + (innerW - wW * s) / 2;
    const offY = PAD_Y + (innerH - wH * s) / 2;
    return (lat: number, lng: number): PT => ({
      x: offX + (lng * kx - wMinX) * s,
      y: offY + (-lat - wMinY) * s,
    });
  }, [journey, position]);

  // Ordered unique nodes: origin → changeovers → destination (dedup collapses a
  // there-and-back into the one-way set, so a round trip isn't drawn twice).
  const nodes = useMemo<NodeVM[]>(() => {
    const seen = new Set<string>();
    const out: NodeVM[] = [];
    journey.legs.forEach((leg) => {
      const fk = keyOf(leg.from);
      if (!seen.has(fk)) {
        seen.add(fk);
        const p = project(leg.from.lat, leg.from.lng);
        out.push({ x: p.x, y: p.y, role: "mid", label: leg.from.code ?? leg.from.name });
      }
      const tk = keyOf(leg.to);
      if (!seen.has(tk)) {
        seen.add(tk);
        const p = project(leg.to.lat, leg.to.lng);
        out.push({ x: p.x, y: p.y, role: "mid", label: leg.to.code ?? leg.to.name });
      }
    });
    if (out.length > 0) {
      out[0].role = "origin";
      out[out.length - 1].role = "dest";
    }
    return out;
  }, [journey, project]);

  // The channel: the outbound route shape, projected. (Skip "back" legs so a
  // round trip doesn't redraw over itself; fall back to a node-to-node line.)
  const channelD = useMemo(() => {
    const pts: PT[] = [];
    for (const leg of journey.legs) {
      if (leg.direction === "back") continue;
      for (const t of leg.track) pts.push(project(t[0], t[1]));
    }
    if (pts.length < 2) return pathFromPoints(nodes.map((n) => ({ x: n.x, y: n.y })));
    return pathFromPoints(pts);
  }, [journey, project, nodes]);

  const you = position ? project(position.lat, position.lng) : null;
  const distMi = Math.round(journey.totalDistanceMi);

  // No box: the map isn't framed — its edge is simply where the content fades
  // out, dissolving into the same cotton page (Connor's note). A soft radial
  // mask feathers the field so there's no hard rectangle.
  const edgeMask =
    "radial-gradient(125% 100% at 50% 44%, #000 60%, rgba(0,0,0,0.55) 82%, transparent 100%)";
  return (
    <div
      className={className}
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "330 / 460",
        background: "transparent",
      }}
    >
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="xMidYMid meet"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          display: "block",
          maskImage: edgeMask,
          WebkitMaskImage: edgeMask,
        }}
        aria-label="Day map — the journey, debossed into cotton"
      >
        <defs>
          <filter id="cm-engrave" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="0.8" stdDeviation="0" floodColor="#fdfcf7" floodOpacity="0.8" />
            <feDropShadow dx="0" dy="-0.5" stdDeviation="0.3" floodColor="#2c3038" floodOpacity="0.3" />
          </filter>
          <filter id="cm-weave">
            <feTurbulence type="fractalNoise" baseFrequency="0.6 0.6" numOctaves={2} stitchTiles="stitch" result="n" />
            <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .035 0" />
            <feComposite operator="over" in2="SourceGraphic" />
          </filter>
          <radialGradient id="cm-vign" cx="50%" cy="44%" r="74%">
            <stop offset="0%" stopColor="#ece8dd" />
            <stop offset="66%" stopColor={C.land} />
            <stop offset="100%" stopColor={C.landLo} />
          </radialGradient>
          <radialGradient id="cm-heading" cx="50%" cy="100%" r="100%">
            <stop offset="0%" stopColor="rgba(31,34,40,0.26)" />
            <stop offset="100%" stopColor="rgba(31,34,40,0)" />
          </radialGradient>
          <filter id="cm-bldg" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0.8" dy="1.5" stdDeviation="0.6" floodColor="#2c3038" floodOpacity="0.24" />
          </filter>
        </defs>

        {/* LAND */}
        <rect x="0" y="0" width={VB_W} height={VB_H} fill="url(#cm-vign)" />
        <rect x="0" y="0" width={VB_W} height={VB_H} fill={C.land} filter="url(#cm-weave)" opacity="0.5" />

        {/* Decorative fabric — a faint, calm whisper of "map" under the route.
            It's fixed texture (NOT real geography), so the contour rings, water
            blob and building clusters that landed randomly over the route were
            clutter — removed. What's left is a few quiet engraved hairlines so
            the field reads as a map without competing with the channel + nodes. */}
        <g fill="none" strokeLinecap="round" opacity="0.45">
          {/* a couple of long roads */}
          <g stroke="rgba(40,44,52,.07)" strokeWidth="2">
            <path d="M-10,318 C70,302 140,308 200,300 C260,292 300,298 340,288" />
            <path d="M56,-10 C70,80 50,150 70,222 C86,284 70,352 92,432" />
          </g>
          {/* one rail line with faint cross-ties */}
          <g stroke="rgba(40,44,52,.08)" strokeLinecap="butt">
            <path d="M22,210 C110,232 214,250 330,244" strokeWidth="1.1" />
            <path d="M22,210 C110,232 214,250 330,244" strokeWidth="3.5" strokeDasharray="1.4 10" />
          </g>
        </g>

        {/* THE JOURNEY — a channel debossed into the cotton (the hero, no colour) */}
        {channelD ? (
          <g fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path d={channelD} stroke="rgba(255,255,250,.8)" strokeWidth="15" transform="translate(0,1.6)" />
            <path d={channelD} stroke="rgba(40,44,52,.22)" strokeWidth="15" transform="translate(0,-1.4)" />
            <path d={channelD} stroke={C.channel} strokeWidth="11" />
            <path d={channelD} stroke="rgba(40,44,52,.10)" strokeWidth="11" transform="translate(0,-0.7)" />
            <path d={channelD} stroke="rgba(40,44,52,.07)" strokeWidth="1.5" />
          </g>
        ) : null}

        {/* NODES — the only charcoal */}
        {nodes.map((n, i) => {
          if (n.role === "mid") {
            // changeover — a pressed well
            return (
              <g key={i}>
                <circle cx={n.x} cy={n.y} r="10" fill={C.channel} />
                <circle cx={n.x} cy={n.y} r="10" fill="none" stroke="rgba(40,44,52,.20)" strokeWidth="1.4" transform="translate(0,-0.9)" />
                <circle cx={n.x} cy={n.y} r="10" fill="none" stroke="rgba(255,255,250,.85)" strokeWidth="1.2" transform="translate(0,1)" />
                <circle cx={n.x} cy={n.y} r="3.2" fill="#3a3e46" />
              </g>
            );
          }
          if (n.role === "dest") {
            // destination — a raised pebble
            return (
              <g key={i}>
                <circle cx={n.x} cy={n.y} r="11" fill={C.widget} />
                <circle cx={n.x} cy={n.y} r="11" fill="none" stroke="rgba(255,255,255,.9)" strokeWidth="1.2" transform="translate(0,-0.9)" />
                <circle cx={n.x} cy={n.y} r="11" fill="none" stroke="rgba(40,44,52,.16)" strokeWidth="1.2" transform="translate(0,1.1)" />
                <circle cx={n.x} cy={n.y} r="3.6" fill={C.char} />
              </g>
            );
          }
          // origin — a charcoal punctuation dot ringed in cotton
          return (
            <g key={i}>
              <circle cx={n.x} cy={n.y} r="9.5" fill={C.widget} />
              <circle cx={n.x} cy={n.y} r="6.5" fill={C.char} />
            </g>
          );
        })}

        {/* YOU — live position, ringed like a GPS dot, with a heading cone */}
        {you ? (
          <g transform={`translate(${you.x.toFixed(1)},${you.y.toFixed(1)})`}>
            <g transform={`rotate(${position?.bearing ?? 0})`}>
              <path d="M0,0 L-22,-46 Q0,-58 22,-46 Z" fill="url(#cm-heading)" />
            </g>
            <circle r="9.5" fill={C.widget} />
            <circle r="7.5" fill={C.char} />
            <circle r="2.6" fill="#f2efe8" />
          </g>
        ) : null}

        {/* ENGRAVED LABELS — beside each node. A "change" label is dropped when it
            sits on top of an endpoint (the brewery is next to Derby station, home
            next to Wellingborough station, so they project together) — the
            endpoint keeps its name, the change keeps just its dot. */}
        <g fontFamily="-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif" fill={C.label} filter="url(#cm-engrave)">
          {nodes.map((n, i) => {
            const origin = nodes[0];
            const dest = nodes[nodes.length - 1];
            const near = (a: NodeVM, b: NodeVM) => Math.hypot(a.x - b.x, a.y - b.y) < 34;
            if (n.role === "mid" && origin && dest && (near(n, origin) || near(n, dest))) {
              return null;
            }
            const rightSide = n.x > VB_W * 0.62;
            return (
              <text
                key={i}
                x={n.x + (rightSide ? -13 : 13)}
                y={n.y + 4}
                textAnchor={rightSide ? "end" : "start"}
                fontSize="12.5"
                fontWeight={n.role === "mid" ? 600 : 700}
              >
                {n.label}
                {n.role === "mid" ? " · change" : ""}
              </text>
            );
          })}
        </g>
      </svg>

      {/* Stat chips — raised cotton, bottom-left */}
      <div style={{ position: "absolute", left: 11, bottom: 11, display: "flex", gap: 9, zIndex: 6 }}>
        <StatChip label="Distance" value={`${distMi}`} unit="mi" />
        <StatChip label="Door to door" value={journey.totalDurationLabel || "—"} />
      </div>
    </div>
  );
}

function StatChip({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div
      style={{
        background: C.widget,
        border: "1px solid rgba(40,44,52,.05)",
        borderRadius: 14,
        padding: "8px 13px 9px",
        minWidth: 74,
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.85), 0 0 0 0.5px rgba(40,44,52,0.04), 0 10px 18px -12px rgba(34,30,24,0.24), 0 3px 7px -5px rgba(34,30,24,0.13)",
      }}
    >
      <div style={{ fontSize: 9, letterSpacing: "0.14em", fontWeight: 700, color: "rgba(32,36,43,0.40)", textTransform: "uppercase" }}>
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 680, color: C.ink, marginTop: 2, letterSpacing: "-0.01em" }}>
        {value}
        {unit ? <span style={{ fontSize: 11, fontWeight: 560, color: "rgba(32,36,43,0.40)", marginLeft: 1 }}>{unit}</span> : null}
      </div>
    </div>
  );
}
