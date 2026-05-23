import Link from "next/link";

type Size = "xs" | "sm" | "md" | "lg" | "xl";

// Mark + wordmark sizing per the brand book's lockup system. The mark
// reads optically smaller than the cap-height, so the wordmark font-size
// is a touch larger than the mark size for visual parity.
const SIZES: Record<Size, { glyph: number; font: number; track: number }> = {
  xs: { glyph: 14, font: 11, track: 0.18 },
  sm: { glyph: 18, font: 13, track: 0.2 },
  md: { glyph: 22, font: 15, track: 0.22 },
  lg: { glyph: 36, font: 26, track: 0.18 },
  xl: { glyph: 56, font: 44, track: 0.14 },
};

// The Khonsera mark — a waxing crescent, drawn as the negative space
// between two perfect circles. Construction (per the brand book, p. 5):
//
//   bounding box  100 × 100
//   outer disc    R₁ = 42, centred (50, 50)
//   inner cut     R₂ = 39, centred (62, 42)   — offset +12 right, 8 up
//
// The resulting asymmetric crescent leans into the upper-right, suggesting
// motion. Rendered as an explicit two-arc path so it composites cleanly
// (no SVG masks) for screenshots, exports and embeddings. Intersection
// points are pre-computed in the 100-unit space.
export function MoonMark({
  size = 22,
  color = "var(--gold)",
  title,
}: {
  size?: number;
  color?: string;
  title?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      style={{ color, flexShrink: 0, display: "block" }}
    >
      {title ? <title>{title}</title> : null}
      <path
        d="M 84.63 73.76 A 42 42 0 1 0 41.39 8.89 A 39 39 0 0 0 84.63 73.76 Z"
        fill="currentColor"
      />
    </svg>
  );
}

// The wordmark — set in Satoshi 500, uppercase, tracked. Monocolour ink
// (brand book p. 9: "Don't recolour. Gold or ink only; never invent
// palettes."). The mark sits to the left per the primary horizontal
// lockup (p. 7).
export function KhonseraBrand({
  size = "md",
  href = "/dashboard",
  asLink = true,
  markColor,
}: {
  size?: Size;
  href?: string;
  asLink?: boolean;
  markColor?: string;
}) {
  const { glyph, font, track } = SIZES[size];
  const Tag = (asLink ? Link : "span") as React.ElementType;

  return (
    <Tag
      {...(asLink ? { href } : {})}
      className="brand-lockup"
      style={{
        fontSize: font,
        gap: Math.max(8, glyph / 2.2),
        lineHeight: 1,
        textDecoration: "none",
        alignItems: "center",
      }}
      aria-label="Khonsera home"
    >
      <MoonMark size={glyph} color={markColor ?? "var(--gold)"} />
      <span
        style={{
          fontFamily: "var(--display)",
          fontWeight: 500,
          textTransform: "uppercase",
          letterSpacing: `${track}em`,
          color: "var(--ink)",
        }}
      >
        Khonsera
      </span>
    </Tag>
  );
}
