import { describe, it, expect } from "vitest";
import { lngLatToTile, tileKey, tilesForCorridor, MAX_CORRIDOR_TILES } from "./tiles";

describe("lngLatToTile", () => {
  it("maps the origin to the centre tile", () => {
    expect(lngLatToTile(0, 0, 1)).toEqual({ x: 1, y: 1 });
  });

  it("maps central London to the known z13 tile", () => {
    // Charing Cross ~ 51.5074, -0.1278 → z13 tile 4093/2723
    // (reference: standard slippy-map tilenames arithmetic)
    expect(lngLatToTile(-0.1278, 51.5074, 13)).toEqual({ x: 4093, y: 2724 });
  });

  it("clamps at the antimeridian and poles", () => {
    const t = lngLatToTile(180, 85.06, 2);
    expect(t.x).toBeLessThanOrEqual(3);
    expect(t.y).toBeGreaterThanOrEqual(0);
  });
});

describe("tilesForCorridor", () => {
  // A ~1.2km straight line through Leicester city centre.
  const line: [number, number][] = Array.from({ length: 25 }, (_, i) => [
    52.6315 + i * 0.0004,
    -1.1250 + i * 0.0002,
  ]);

  it("covers every point of the line at every requested zoom", () => {
    const tiles = tilesForCorridor(line, { zooms: [13, 15] });
    const keys = new Set(tiles.map(tileKey));
    for (const [lat, lng] of line) {
      for (const z of [13, 15]) {
        const t = lngLatToTile(lng, lat, z);
        expect(keys.has(`${z}/${t.x}/${t.y}`)).toBe(true);
      }
    }
  });

  it("deduplicates tiles", () => {
    const tiles = tilesForCorridor(line, { zooms: [13] });
    const keys = tiles.map(tileKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("adds detail tiles around maneuver points", () => {
    const tiles = tilesForCorridor(line, { zooms: [13], detailPoints: [line[0]], detailZoom: 16 });
    expect(tiles.some((t) => t.z === 16)).toBe(true);
  });

  it("caps the total, keeping full coarse-zoom coverage and trimming the finest", () => {
    // A long route (~110km of points) would explode at z15 without the cap.
    const long: [number, number][] = Array.from({ length: 400 }, (_, i) => [52.0 + i * 0.0025, -1.0]);
    const uncapped = tilesForCorridor(long, { zooms: [13, 15], cap: 10_000 });
    const capped = tilesForCorridor(long, { zooms: [13, 15], cap: 100 });
    expect(capped.length).toBeLessThanOrEqual(100);
    // Every coarse (z13) tile survives the trim — whole route stays mapped.
    const cappedKeys = new Set(capped.map(tileKey));
    for (const t of uncapped.filter((t) => t.z === 13)) {
      expect(cappedKeys.has(tileKey(t))).toBe(true);
    }
  });

  it("uses the default cap when none given", () => {
    const long: [number, number][] = Array.from({ length: 1000 }, (_, i) => [51.0 + i * 0.003, -1.0]);
    const tiles = tilesForCorridor(long);
    expect(tiles.length).toBeLessThanOrEqual(MAX_CORRIDOR_TILES);
  });
});
