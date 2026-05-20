import Link from "next/link";
import { MoonMark } from "@/components/khonsera-brand";

export default function LandingPage() {
  return (
    <main
      className="paper-tex"
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "var(--paper)",
      }}
    >
      {/* Eyebrow */}
      <div
        style={{
          padding: "26px 28px 0",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <span
          className="eyebrow"
          style={{ color: "var(--gold-2)", letterSpacing: "0.22em" }}
        >
          KHONSU · SERA
        </span>
      </div>

      {/* Wordmark hero */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          padding: "0 28px",
          gap: 22,
          textAlign: "center",
        }}
      >
        <MoonMark size={56} color="var(--gold)" />
        <h1
          className="wordmark"
          style={{ fontSize: "clamp(56px, 11vw, 110px)", margin: 0 }}
        >
          Khon<span className="em">sera</span>
        </h1>

        <Ornament />

        <p
          className="standfirst"
          style={{ maxWidth: 520, fontSize: 18, color: "var(--ink-2)" }}
        >
          The traveller&rsquo;s evening — <em>plan, book and keep</em> the
          days a working life is built of.
        </p>
      </div>

      {/* Four pillars */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 12,
          padding: "8px 28px 32px",
          maxWidth: 720,
          margin: "0 auto",
          width: "100%",
        }}
      >
        {[
          ["Plan", "Your journey,\nend to end.", "calendar"],
          ["Book", "Everything in\none place.", "ticket"],
          ["Keep", "Stay on time\nand on track.", "clock"],
          ["Go", "Travel with\nconfidence.", "nav"],
        ].map(([label, copy, glyph]) => (
          <Pillar key={label} label={label as string} copy={copy as string} glyph={glyph as string} />
        ))}
      </div>

      {/* CTAs */}
      <div
        style={{
          padding: "0 28px 36px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          maxWidth: 460,
          margin: "0 auto",
          width: "100%",
        }}
      >
        <Link href="/login" className="btn btn-gold btn-full btn-lg">
          Begin · sign in
          <Arrow />
        </Link>
        <Link href="/signup" className="btn btn-ghost btn-full">
          Create an account
        </Link>
        <p
          style={{
            textAlign: "center",
            fontSize: 11,
            color: "var(--ink-faint)",
            margin: "6px 0 0",
            letterSpacing: 0.02,
          }}
        >
          Calm. Considered. Confident.
        </p>
      </div>
    </main>
  );
}

function Ornament() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ width: 32, height: 1, background: "var(--rule-2)" }} />
      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
        <path
          d="M5 0 L5.7 4.3 L10 5 L5.7 5.7 L5 10 L4.3 5.7 L0 5 L4.3 4.3 Z"
          fill="var(--gold)"
        />
      </svg>
      <span style={{ width: 32, height: 1, background: "var(--rule-2)" }} />
    </div>
  );
}

function Pillar({
  label,
  copy,
  glyph,
}: {
  label: string;
  copy: string;
  glyph: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 999,
          border: "1px solid var(--gold)",
          background: "var(--gold-tint)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--gold-2)",
        }}
      >
        <PillarIcon name={glyph} />
      </div>
      <span
        className="mono"
        style={{
          fontSize: 10,
          letterSpacing: 0.18,
          textTransform: "uppercase",
          color: "var(--ink-2)",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 11,
          textAlign: "center",
          color: "var(--ink-dim)",
          lineHeight: 1.4,
          whiteSpace: "pre-line",
        }}
      >
        {copy}
      </span>
    </div>
  );
}

function PillarIcon({ name }: { name: string }) {
  const d =
    name === "calendar"
      ? "M4 6 a2 2 0 0 1 2-2 h12 a2 2 0 0 1 2 2 v14 a2 2 0 0 1-2 2 H6 a2 2 0 0 1-2-2 z M4 10 h16 M8 2 v4 M16 2 v4"
      : name === "ticket"
        ? "M3 9 a2 2 0 0 1 2-2 h14 a2 2 0 0 1 2 2 v2 a2 2 0 0 0 0 2 v2 a2 2 0 0 1-2 2 H5 a2 2 0 0 1-2-2 v-2 a2 2 0 0 0 0-2 z M9 7 v10"
        : name === "clock"
          ? "M12 22 a10 10 0 1 0 0-20 a10 10 0 0 0 0 20 z M12 6 v6 l4 2"
          : "M3 11 L21 3 L13 21 L11 13 L3 11 z";
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={d} />
    </svg>
  );
}

function Arrow() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path
        d="M5 12h14M13 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
