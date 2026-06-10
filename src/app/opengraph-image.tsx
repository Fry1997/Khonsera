import { ImageResponse } from "next/og";

// Landing+waitlist brief §7 — the link preview is the first impression when the
// URL is pasted to a supplier. The wordmark on linen, with one gold accent and
// the tagline. Code-authored placeholder on the brand palette; Design owns the
// final card (the brief flags the image as a deliverable to elevate).
//
// Token values are inlined as literals here ONLY because next/og renders in an
// isolated context that cannot read CSS custom properties. These mirror the
// Edition II light palette (paper / ink / gold).

export const runtime = "nodejs";
export const alt = "Khonsera — your travel, quietly handled.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const PAPER = "#f5f1e8";
const INK = "#2b2722";
const INK_DIM = "#7a7163";
const GOLD = "#b8893f";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          background: PAPER,
          padding: "0 120px",
        }}
      >
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: 10,
            background: GOLD,
            marginBottom: 40,
          }}
        />
        <div
          style={{
            fontSize: 132,
            letterSpacing: "-0.02em",
            color: INK,
            fontWeight: 500,
            lineHeight: 1,
          }}
        >
          Khonsera
        </div>
        <div
          style={{
            marginTop: 36,
            fontSize: 38,
            color: INK_DIM,
            letterSpacing: "-0.01em",
          }}
        >
          Your travel, quietly handled.
        </div>
      </div>
    ),
    { ...size },
  );
}
