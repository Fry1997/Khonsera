"use client";

import dynamic from "next/dynamic";
import type { CSSProperties } from "react";
import type { NavMapProps } from "./nav-map";

// Lazy MapLibre — keeps maplibre-gl (~350 kB) out of the initial bundle of a
// surface that only *sometimes* shows a map (e.g. Today's next-leg map). The map
// engine loads as its own chunk when the component actually mounts.
//
// Pop-in safety: this wrapper reserves NavMap's EXACT box (same height / minHeight
// / radius / a calm themed ground) BEFORE the chunk arrives, so the map paints
// INTO a stable frame — no layout shift, no skeleton flash, no spinner. (The nav
// page itself imports NavMap directly — there the map IS the page, so eager.)

const Inner = dynamic(() => import("./nav-map").then((m) => m.NavMap), {
  ssr: false,
  loading: () => null,
});

function frame(height?: number): CSSProperties {
  return {
    position: "relative",
    width: "100%",
    height: height ? `${height}px` : "100%",
    minHeight: height ?? 320,
    borderRadius: "var(--radius-lg)",
    overflow: "hidden",
    background: "var(--paper)",
  };
}

export function LazyNavMap(props: NavMapProps) {
  return (
    <div style={frame(props.height)}>
      <Inner {...props} />
    </div>
  );
}
