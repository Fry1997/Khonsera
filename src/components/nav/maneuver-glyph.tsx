import type { ManeuverKind } from "@/lib/nav/types";

// The turn arrow — shared by the full /navigate screen and the inline next-leg
// guidance HUD so they read identically.
export const GLYPH_PATHS: Record<ManeuverKind, string> = {
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

export function ManeuverGlyph({ kind, size = 20, color = "var(--gold-2)" }: { kind: ManeuverKind; size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0 }}>
      <path d={GLYPH_PATHS[kind] ?? GLYPH_PATHS.other} />
    </svg>
  );
}
