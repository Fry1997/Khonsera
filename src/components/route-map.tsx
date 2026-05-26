"use client";

type Stop = {
  lat: number;
  lng: number;
  label: string;
  code?: string;
  role: "home" | "transit" | "site";
};

type RouteMapProps = {
  stops: Stop[];
  polylines: string[];
  totalMiles?: number;
  totalMinutes?: number;
  width?: number;
  height?: number;
};

export function RouteMap({
  stops,
  polylines,
  totalMiles,
  totalMinutes,
  width = 400,
  height = 280,
}: RouteMapProps) {
  if (stops.length === 0) return null;

  const { center, zoom } = fitBounds(stops, width, height);
  const mapScale = 2;

  const spec = JSON.stringify({
    width,
    height,
    zoom,
    center,
    markers: [],
    paths: polylines.map((encoded) => ({
      encoded,
      color: "936820",
      weight: 5,
    })),
    style: "journies",
  });
  const b64 = btoa(unescape(encodeURIComponent(spec)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const mapUrl = `/api/maps/static?s=${b64}`;

  const markerPositions = stops.map((s) => ({
    ...s,
    ...latLngToPixel(s.lat, s.lng, center.lat, center.lng, zoom, width, height, mapScale),
  }));

  const hasSummary = totalMiles != null || totalMinutes != null;

  return (
    <div className="route-map-card">
      {hasSummary && (
        <div className="route-map-header">
          <span className="route-map-eyebrow">Door-to-door</span>
          <span className="route-map-headline">
            {totalMiles != null && totalMiles > 0 && <>{Math.round(totalMiles)} mi</>}
            {totalMiles != null && totalMiles > 0 && totalMinutes != null && totalMinutes > 0 && " · "}
            {totalMinutes != null && totalMinutes > 0 && <>{fmtDuration(totalMinutes)}</>}
          </span>
        </div>
      )}
      <div
        className="route-map-container"
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: `${width} / ${height}`,
          overflow: "hidden",
          borderRadius: hasSummary ? "0 0 12px 12px" : 12,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={mapUrl}
          alt="Route map"
          style={{
            display: "block",
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
        {markerPositions.map((m, i) => (
          <div
            key={i}
            className={`route-map-marker route-map-marker-${m.role}`}
            style={{
              position: "absolute",
              left: `${(m.x / width) * 100}%`,
              top: `${(m.y / height) * 100}%`,
              transform: "translate(-4px, -50%)",
            }}
          >
            <div className="route-map-dot" />
            <span className="route-map-code">{m.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function latLngToPixel(
  lat: number,
  lng: number,
  centerLat: number,
  centerLng: number,
  zoom: number,
  width: number,
  height: number,
  scale: number,
): { x: number; y: number } {
  const tileSize = 256;
  const totalPixels = Math.pow(2, zoom) * tileSize;

  const worldX = ((lng + 180) / 360) * totalPixels;
  const latRad = (lat * Math.PI) / 180;
  const worldY =
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) *
    totalPixels;

  const centerWorldX = ((centerLng + 180) / 360) * totalPixels;
  const centerLatRad = (centerLat * Math.PI) / 180;
  const centerWorldY =
    ((1 -
      Math.log(Math.tan(centerLatRad) + 1 / Math.cos(centerLatRad)) /
        Math.PI) /
      2) *
    totalPixels;

  return {
    x: (worldX - centerWorldX) / scale + width / 2,
    y: (worldY - centerWorldY) / scale + height / 2,
  };
}

function fitBounds(
  stops: Stop[],
  width: number,
  height: number,
): { center: { lat: number; lng: number }; zoom: number } {
  if (stops.length === 1) {
    return { center: { lat: stops[0].lat, lng: stops[0].lng }, zoom: 14 };
  }

  const lats = stops.map((s) => s.lat);
  const lngs = stops.map((s) => s.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  const center = {
    lat: (minLat + maxLat) / 2,
    lng: (minLng + maxLng) / 2,
  };

  const latSpan = maxLat - minLat;
  const lngSpan = maxLng - minLng;

  const pad = 0.3;
  const paddedLatSpan = latSpan * (1 + pad);
  const paddedLngSpan = lngSpan * (1 + pad);

  let zoom = 20;
  for (let z = 20; z >= 1; z--) {
    const totalPixels = Math.pow(2, z) * 256;
    const lngPixels = (paddedLngSpan / 360) * totalPixels;
    const latRadN = ((center.lat + paddedLatSpan / 2) * Math.PI) / 180;
    const latRadS = ((center.lat - paddedLatSpan / 2) * Math.PI) / 180;
    const yN =
      ((1 - Math.log(Math.tan(latRadN) + 1 / Math.cos(latRadN)) / Math.PI) /
        2) *
      totalPixels;
    const yS =
      ((1 - Math.log(Math.tan(latRadS) + 1 / Math.cos(latRadS)) / Math.PI) /
        2) *
      totalPixels;
    const latPixels = Math.abs(yS - yN);

    if (lngPixels <= width * 2 && latPixels <= height * 2) {
      zoom = z;
      break;
    }
  }

  return { center, zoom };
}

function fmtDuration(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
