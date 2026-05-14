import type { StaticMapMarker, StaticMapPath } from "@/lib/google/maps";

// Server-side component that renders a static map via our proxy. We encode
// the spec into a base64url query param so the URL is stable and easily
// cacheable.

export function StaticMap({
  markers = [],
  paths = [],
  width = 800,
  height = 320,
  zoom,
  center,
  alt = "Map",
  className,
}: {
  markers?: StaticMapMarker[];
  paths?: StaticMapPath[];
  width?: number;
  height?: number;
  zoom?: number;
  center?: { lat: number; lng: number };
  alt?: string;
  className?: string;
}) {
  if (markers.length === 0 && paths.length === 0) return null;

  const spec = { width, height, zoom, center, markers, paths };
  const encoded = Buffer.from(JSON.stringify(spec), "utf8").toString("base64url");
  const src = `/api/maps/static?s=${encoded}`;

  // Two-up size: ask for 2x scale upstream (handled by the proxy via the
  // builder) for retina sharpness. The <img> renders at logical size.
  return (
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={`block w-full rounded border border-rule ${className ?? ""}`}
      style={{ aspectRatio: `${width} / ${height}`, objectFit: "cover" }}
    />
  );
}
