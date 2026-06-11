// Encoded-polyline decoder with selectable precision. Valhalla shapes are
// precision 6 (1e6); Google/our rail cache are precision 5 (1e5) — the
// journey-map decoder is hardwired to 5, so the nav layer carries its own.
export function decodeShape(encoded: string, precision: 5 | 6 = 6): [number, number][] {
  const factor = precision === 6 ? 1e6 : 1e5;
  const points: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push([lat / factor, lng / factor]);
  }

  return points;
}
