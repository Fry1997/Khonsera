// Khonsera transport + stop icon set — single source of truth so we never
// reach for an emoji again. Every icon is a stroke-based SVG, 24×24
// viewBox, currentColor — drop it inline and tint via CSS.

import type { SVGProps } from "react";

type IconProps = Omit<SVGProps<SVGSVGElement>, "stroke"> & {
  size?: number;
  // Stroke width — defaults to 1.7. Named to avoid colliding with the
  // SVG `stroke` colour prop (which we always set to currentColor).
  strokeWidth?: number;
};

function Svg({
  size = 18,
  strokeWidth = 1.7,
  children,
  ...rest
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...rest}
    >
      {children}
    </svg>
  );
}

// ── Transport modes ──────────────────────────────────────────────────

export const TransportIcon = {
  walk: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="13" cy="4.5" r="1.5" />
      <path d="M9 21l3-6 2 2 3 4M9 13l3-4 3 2" />
    </Svg>
  ),
  drive: (p: IconProps) => (
    <Svg {...p}>
      <path d="M3 13l2-5a3 3 0 0 1 3-2h8a3 3 0 0 1 3 2l2 5v5h-3v-2H6v2H3z" />
      <circle cx="7.5" cy="15" r="1.2" />
      <circle cx="16.5" cy="15" r="1.2" />
    </Svg>
  ),
  taxi: (p: IconProps) => (
    <Svg {...p}>
      <path d="M3 13l2-5a3 3 0 0 1 3-2h8a3 3 0 0 1 3 2l2 5v5h-3v-2H6v2H3z" />
      <circle cx="7.5" cy="15" r="1.2" />
      <circle cx="16.5" cy="15" r="1.2" />
      <path d="M10 4h4M10 2v2M14 2v2" />
    </Svg>
  ),
  train: (p: IconProps) => (
    <Svg {...p}>
      <rect x="5" y="3" width="14" height="14" rx="3" />
      <path d="M5 11h14M9 21l-2-3M15 21l2-3" />
      <circle cx="9" cy="14" r="0.8" fill="currentColor" stroke="none" />
      <circle cx="15" cy="14" r="0.8" fill="currentColor" stroke="none" />
    </Svg>
  ),
  tube: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
    </Svg>
  ),
  bus: (p: IconProps) => (
    <Svg {...p}>
      <rect x="4" y="4" width="16" height="13" rx="2" />
      <path d="M4 11h16M8 21l-1-4M16 21l1-4" />
      <circle cx="8" cy="14.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="16" cy="14.5" r="1" fill="currentColor" stroke="none" />
    </Svg>
  ),
  flight: (p: IconProps) => (
    <Svg {...p}>
      <path d="M2 14l20-7-7 18-3-7z" />
    </Svg>
  ),
  mixed: (p: IconProps) => (
    <Svg {...p}>
      <path d="M5 12h14M13 6l6 6-6 6M11 18l-6-6 6-6" />
    </Svg>
  ),
  // "auto" — Khonsera picks. A small sparkle/wand mark.
  auto: (p: IconProps) => (
    <Svg {...p}>
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6L7.7 7.7M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
      <circle cx="12" cy="12" r="2" />
    </Svg>
  ),
} satisfies Record<string, (p: IconProps) => React.ReactElement>;

export type TransportName = keyof typeof TransportIcon;

// ── Stop types ───────────────────────────────────────────────────────

export const StopIcon = {
  home: (p: IconProps) => (
    <Svg {...p}>
      <path d="M3 11l9-7 9 7v9a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2z" />
    </Svg>
  ),
  appointment: (p: IconProps) => (
    <Svg {...p}>
      <path d="M3 10l4-4 3 3 3-3 4 4 M3 14l5 5 4-4 4 4 5-5" />
    </Svg>
  ),
  stay: (p: IconProps) => (
    <Svg {...p}>
      <path d="M3 18v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5M3 18h18M3 18v2M21 18v2M7 11V8a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v3" />
    </Svg>
  ),
  meal: (p: IconProps) => (
    <Svg {...p}>
      <path d="M8 3v8a3 3 0 0 0 3 3v7M8 3v5M11 3v5M16 3c-2 0-2 5 0 8v10" />
    </Svg>
  ),
  event: (p: IconProps) => (
    <Svg {...p}>
      <path d="M3 9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 2v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-2z" />
      <path d="M9 7v10" strokeDasharray="2 2" />
    </Svg>
  ),
  station: (p: IconProps) => (
    <Svg {...p}>
      <rect x="5" y="3" width="14" height="14" rx="3" />
      <path d="M5 11h14M9 21l-2-3M15 21l2-3" />
    </Svg>
  ),
  flag: (p: IconProps) => (
    <Svg {...p}>
      <path d="M5 22V4M5 4h11l-2 3 2 3H5" />
    </Svg>
  ),
  pin: (p: IconProps) => (
    <Svg {...p}>
      <path d="M12 22s-7-7.5-7-13a7 7 0 1 1 14 0c0 5.5-7 13-7 13z" />
      <circle cx="12" cy="9" r="2.3" />
    </Svg>
  ),
  ticket: (p: IconProps) => (
    <Svg {...p}>
      <path d="M3 9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 2v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-2z" />
      <path d="M9 7v10" strokeDasharray="2 2" />
    </Svg>
  ),
  wait: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </Svg>
  ),
} satisfies Record<string, (p: IconProps) => React.ReactElement>;

export type StopIconName = keyof typeof StopIcon;
