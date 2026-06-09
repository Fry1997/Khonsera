import Link from "next/link";

type Size = "xs" | "sm" | "md" | "lg" | "xl";
export type MarkVariant = "crescent" | "hairline" | "crescent-star" | "seal";

const SIZES: Record<Size, { glyph: number; font: number; track: number }> = {
  xs: { glyph: 16, font: 11, track: 0.18 },
  sm: { glyph: 22, font: 13, track: 0.2 },
  md: { glyph: 28, font: 15, track: 0.22 },
  lg: { glyph: 44, font: 26, track: 0.18 },
  xl: { glyph: 72, font: 44, track: 0.14 },
};

// Crescent construction: outer disc R, inner disc r offset by (dx, dy)
// from the viewbox centre. The path traces the boundary of outer ∩ ¬inner —
// the visible waxing-crescent body. Ported from the canonical moon-mark.js.
function crescentPath(
  s: number,
  R: number,
  r: number,
  dx: number,
  dy: number,
): string {
  const cx1 = s * 0.5;
  const cy1 = s * 0.5;
  const d = Math.hypot(dx, dy);
  const a = (d * d + R * R - r * r) / (2 * d);
  const h = Math.sqrt(Math.max(0, R * R - a * a));
  const ux = dx / d;
  const uy = dy / d;
  const px = cx1 + a * ux;
  const py = cy1 + a * uy;
  const i1x = px + h * -uy;
  const i1y = py + h * ux;
  const i2x = px - h * -uy;
  const i2y = py - h * ux;
  return (
    `M ${i1x.toFixed(2)} ${i1y.toFixed(2)} ` +
    `A ${R} ${R} 0 1 1 ${i2x.toFixed(2)} ${i2y.toFixed(2)} ` +
    `A ${r} ${r} 0 0 0 ${i1x.toFixed(2)} ${i1y.toFixed(2)} Z`
  );
}

// The Khonsera mark. Four sanctioned variants per the brand book (p. 6):
//
//   crescent       — solid waxing crescent. The workhorse.
//   hairline       — outline of the same. Seals & stationery.
//   crescent-star  — submark with a tiny accompanying star. Ceremony.
//   seal           — concentric rings + tiny crescent. Crest, invitations,
//                    app icon, favicon, wax seal. (Default.)
//
// Geometry mirrors moon-mark.js: a dynamic viewBox so stroke widths scale
// with display size and stay visually consistent at any render dimension.
export function MoonMark({
  size = 28,
  color = "var(--gold)",
  variant = "seal",
  title,
}: {
  size?: number;
  color?: string;
  variant?: MarkVariant;
  title?: string;
}) {
  const s = size;
  const stroke = Math.max(1.2, s / 36);

  let body: React.ReactNode;
  switch (variant) {
    case "hairline": {
      const d = crescentPath(s, s * 0.42, s * 0.39, s * 0.12, -s * 0.08);
      body = (
        <path
          d={d}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinejoin="round"
        />
      );
      break;
    }
    case "crescent-star": {
      const d = crescentPath(s, s * 0.34, s * 0.31, s * 0.1, -s * 0.06);
      const star = `M0 ${-s * 0.06} L${s * 0.018} ${-s * 0.018} L${s * 0.06} 0 ` +
        `L${s * 0.018} ${s * 0.018} L0 ${s * 0.06} ` +
        `L${-s * 0.018} ${s * 0.018} L${-s * 0.06} 0 ` +
        `L${-s * 0.018} ${-s * 0.018} Z`;
      body = (
        <>
          <path d={d} fill="currentColor" />
          <g transform={`translate(${s * 0.82} ${s * 0.18})`} fill="currentColor">
            <path d={star} />
          </g>
        </>
      );
      break;
    }
    case "seal": {
      const d = crescentPath(s, s * 0.2, s * 0.185, s * 0.06, -s * 0.04);
      body = (
        <>
          <circle
            cx={s * 0.5}
            cy={s * 0.5}
            r={s * 0.46}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke * 0.8}
          />
          <circle
            cx={s * 0.5}
            cy={s * 0.5}
            r={s * 0.38}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke * 0.4}
            opacity={0.55}
          />
          <path d={d} fill="currentColor" />
        </>
      );
      break;
    }
    case "crescent":
    default: {
      const d = crescentPath(s, s * 0.42, s * 0.39, s * 0.12, -s * 0.08);
      body = <path d={d} fill="currentColor" />;
      break;
    }
  }

  return (
    <svg
      width={s}
      height={s}
      viewBox={`0 0 ${s} ${s}`}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      style={{ color, flexShrink: 0, display: "block" }}
    >
      {title ? <title>{title}</title> : null}
      {body}
    </svg>
  );
}

// The wordmark — Satoshi 500, uppercase, tracked. Monocolour ink (brand
// book p. 9: "Don't recolour. Gold or ink only; never invent palettes.").
// Horizontal lockup per p. 7.
export function KhonseraBrand({
  size = "md",
  href = "/today",
  asLink = true,
  markColor,
  variant = "seal",
}: {
  size?: Size;
  href?: string;
  asLink?: boolean;
  markColor?: string;
  variant?: MarkVariant;
}) {
  const { glyph, font, track } = SIZES[size];
  const Tag = (asLink ? Link : "span") as React.ElementType;

  return (
    <Tag
      {...(asLink ? { href } : {})}
      className="brand-lockup"
      style={{
        fontSize: font,
        gap: Math.max(8, glyph / 2.8),
        lineHeight: 1,
        textDecoration: "none",
        alignItems: "center",
      }}
      aria-label="Khonsera home"
    >
      {/* Edition II emblem (cradle + chevron). The old crescent/moon mark is
          retired per the brand book + Round 1 redline — one mark, used with
          discipline (wordmark lockup + the NudgeCard mark only). */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/mk-ink.png"
        alt=""
        width={glyph}
        height={glyph}
        style={{ display: "block", objectFit: "contain" }}
      />
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
