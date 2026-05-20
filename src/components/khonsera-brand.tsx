import Link from "next/link";

type Size = "xs" | "sm" | "md" | "lg" | "xl";
const SIZES: Record<Size, { glyph: number; font: number }> = {
  xs: { glyph: 16, font: 16 },
  sm: { glyph: 18, font: 18 },
  md: { glyph: 22, font: 22 },
  lg: { glyph: 32, font: 38 },
  xl: { glyph: 48, font: 64 },
};

export function MoonMark({
  size = 22,
  color = "var(--gold)",
}: {
  size?: number;
  color?: string;
}) {
  // The Khonsera moon glyph — a half-disc crescent, the silhouette of the
  // god Khonsu's lunar disc. Rendered as the difference of two circles.
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden
      style={{ color, flexShrink: 0 }}
    >
      <path
        d="M14.5 3.3a9 9 0 1 0 6.2 12.1A7 7 0 0 1 14.5 3.3Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function KhonseraBrand({
  size = "md",
  href = "/dashboard",
  asLink = true,
}: {
  size?: Size;
  href?: string;
  asLink?: boolean;
}) {
  const { glyph, font } = SIZES[size];
  const Tag = (asLink ? Link : "span") as React.ElementType;

  return (
    <Tag
      {...(asLink ? { href } : {})}
      className="brand-lockup"
      style={{
        fontSize: font,
        gap: Math.max(6, glyph / 3),
        lineHeight: 1,
        textDecoration: "none",
      }}
      aria-label="Khonsera home"
    >
      <MoonMark size={glyph} />
      <span style={{ fontFamily: "var(--display)", fontStyle: "italic" }}>
        Khon
        <span style={{ color: "var(--gold)" }}>sera</span>
      </span>
    </Tag>
  );
}
