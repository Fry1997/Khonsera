import type {
  MapStyle,
  StaticMapMarker,
  StaticMapPath,
} from "@/lib/google/maps";

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
  style = "journies",
}: {
  markers?: StaticMapMarker[];
  paths?: StaticMapPath[];
  width?: number;
  height?: number;
  zoom?: number;
  center?: { lat: number; lng: number };
  alt?: string;
  className?: string;
  style?: MapStyle;
}) {
  if (markers.length === 0 && paths.length === 0) return null;

  const spec = { width, height, zoom, center, markers, paths, style };
  const encoded = Buffer.from(JSON.stringify(spec), "utf8").toString("base64url");
  const src = `/api/maps/static?s=${encoded}`;

  // Two-up size: ask for 2x scale upstream (handled by the proxy via the
  // builder) for retina sharpness. The <img> renders at logical size.
  // The framing — paper-toned border + faint inner ring — keeps the map
  // sitting inside the editorial palette rather than punching out of it.
  return (
    <figure
      className={`relative overflow-hidden rounded-md border border-rule bg-card ${className ?? ""}`}
      style={{ aspectRatio: `${width} / ${height}` }}
    >
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        className="block h-full w-full"
        style={{ objectFit: "cover" }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-md ring-1 ring-inset ring-[rgba(26,22,18,0.04)]"
      />
    </figure>
  );
}
