import Link from "next/link";

// Landing / first-touch — Design Round 2 (`.cc-landing-*`). Edition II: the
// locked emblem (no crescent), Satoshi wordmark, one Spectral clause, one gold CTA.

const VALUES = [
  { k: "Plan", d: "Your journey, end to end.", icon: "M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z M4 10h16M8 2v4M16 2v4" },
  { k: "Book", d: "Everything in one place.", icon: "M3 9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 2v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-2z M9 7v10" },
  { k: "Keep", d: "Stay on time, on track.", icon: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 8v4l3 2" },
  { k: "Go", d: "Travel with confidence.", icon: "M3 11l18-8-8 18-2-8-8-2z" },
];

function Ico({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

export default function LandingPage() {
  return (
    <main className="cc-landing paper-tex">
      <div className="cc-landing-inner">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="cc-landing-emblem" src="/brand/mk-ink.png" alt="" />
        <div className="cc-landing-wm">KHONSERA</div>

        <div className="cc-landing-rule">
          <span className="dot" />
        </div>

        <p className="cc-landing-prop">
          A quiet concierge for the slow blue hour — Khonsera plans{" "}
          <em>the in-between hours of getting there</em>: the train that might not be
          running, the taxi at dusk, the careful arithmetic.
        </p>

        <div className="cc-landing-values">
          {VALUES.map((v) => (
            <div key={v.k} className="cc-landing-value">
              <span className="ic"><Ico d={v.icon} /></span>
              <span className="k">{v.k}</span>
              <span className="d">{v.d}</span>
            </div>
          ))}
        </div>

        <div className="cc-landing-cta">
          <Link href="/login" className="cc-btn cc-btn-gold cc-btn-block">
            Begin · sign in
          </Link>
          <Link href="/signup" className="cc-btn cc-btn-ghost cc-btn-block">
            Create an account
          </Link>
        </div>

        <div className="cc-landing-foot">Calm · Considered · Precise</div>
      </div>
    </main>
  );
}
