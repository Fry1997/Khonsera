/**
 * Hook that subscribes to MapLibre map move/zoom events and exposes
 * a `project(lngLat)` function that converts geographic coordinates
 * to pixel positions relative to the map container.
 *
 * Returns a render token that increments on every camera change,
 * driving React re-renders of the SVG overlay.
 */
import { useEffect, useState, useCallback, useRef } from "react";
import type { Map as MLMap } from "maplibre-gl";

export interface ProjectFn {
  (lat: number, lng: number): { x: number; y: number };
}

export function useMapProjection(map: MLMap | null) {
  const [renderToken, setRenderToken] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!map) return;

    const onMove = () => {
      // Throttle re-renders with requestAnimationFrame
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        setRenderToken((t) => t + 1);
      });
    };

    map.on("move", onMove);
    map.on("zoom", onMove);
    map.on("resize", onMove);

    return () => {
      map.off("move", onMove);
      map.off("zoom", onMove);
      map.off("resize", onMove);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [map]);

  const project: ProjectFn = useCallback(
    (lat: number, lng: number) => {
      if (!map) return { x: 0, y: 0 };
      const p = map.project([lng, lat]); // MapLibre uses [lng, lat]
      return { x: p.x, y: p.y };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [map, renderToken],
  );

  return { project, renderToken };
}
