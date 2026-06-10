import { ImageResponse } from "next/og";

// Landing+waitlist brief §7 — the link preview is the first impression when the
// URL is pasted to a supplier. Round 3 (Design): the wordmark over a "slow blue
// hour" linen wash, eyebrow, the promise stated once and large, one editorial
// sub. This rebuilds Design's OG-card composition in next/og.
//
// Palette values are inlined as literals because next/og (Satori) renders in an
// isolated context that can't read CSS custom properties; they mirror Design's
// OG-card.html (Edition II light palette). Type renders in Satori's default
// sans — for pixel-exact Satoshi we'd drop in a flat PNG export instead.

export const runtime = "nodejs";
export const alt = "Khonsera — your travel, quietly handled.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = "#1b1712";
const INK_2 = "#34302a";
const GOLD = "#8f6722";
const GOLD_DOT = "#b8893f";
const FOOT = "#9a8f7d";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "80px 88px",
          background:
            "radial-gradient(80% 120% at 50% -20%, #efe2c2 0%, transparent 58%), linear-gradient(176deg, #f5f1e8 0%, #efe9db 100%)",
        }}
      >
        {/* Top — the wordmark */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <div
            style={{
              fontSize: 30,
              fontWeight: 500,
              letterSpacing: "0.04em",
              color: INK,
            }}
          >
            Khonsera
          </div>
        </div>

        {/* Middle — eyebrow + the promise, once and large */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 17,
              letterSpacing: "0.28em",
              textTransform: "uppercase",
              color: GOLD,
              marginBottom: 26,
            }}
          >
            A travel concierge
          </div>
          <div
            style={{
              fontSize: 82,
              fontWeight: 500,
              lineHeight: 0.98,
              letterSpacing: "-0.035em",
              color: INK,
              maxWidth: "17ch",
            }}
          >
            Your travel, quietly handled.
          </div>
          <div
            style={{
              fontSize: 26,
              lineHeight: 1.45,
              color: INK_2,
              marginTop: 30,
              maxWidth: "40ch",
            }}
          >
            For the hours between destinations — the train that might not run,
            the taxi at dusk.
          </div>
        </div>

        {/* Foot — domain + tagline */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 16,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: FOOT,
          }}
        >
          <div style={{ display: "flex" }}>khonsera.com</div>
          <div style={{ display: "flex", alignItems: "center" }}>
            Travel days
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: 6,
                background: GOLD_DOT,
                margin: "0 12px",
              }}
            />
            considered
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
