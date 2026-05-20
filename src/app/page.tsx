import Link from "next/link";
import { FlankEyebrow, Masthead, Stat, StatGroup } from "@/components/ui/editorial";

export default function LandingPage() {
  return (
    <main className="paper-tex flex min-h-screen flex-col">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-10 px-5 py-12 sm:gap-12 sm:px-6 sm:py-16">
        <div className="brand-lockup">
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
            <path
              d="M14.5 3.3a9 9 0 1 0 6.2 12.1A7 7 0 0 1 14.5 3.3Z"
              fill="currentColor"
              style={{ color: "var(--gold)" }}
            />
          </svg>
          <span>
            Khonser<span style={{ color: "var(--gold)" }}>a</span>
          </span>
        </div>

        <Masthead
          eyebrow={<FlankEyebrow align="left">Quietly luxe travel planning</FlankEyebrow>}
          title="Know whether you can"
          em="actually get there"
          trailing={<span className="text-ink">— before you say yes.</span>}
          standfirst={
            <>
              Plan, book, calendar and navigate every trip door to door.
              Travel-aware feasibility, <em>rail vs drive</em> comparison,
              partner booking and on-the-day guidance — all in one warmly
              editorial space.
            </>
          }
          actions={
            <>
              <Link href="/login" className="btn-gold">
                Sign in
              </Link>
              <Link href="/signup" className="btn-ghost">
                Create account
              </Link>
            </>
          }
        />

        <StatGroup up={3} compact>
          <Stat value="door → door" label="every leg planned" />
          <Stat value="rail · drive" label="feasibility compared" />
          <Stat value="one app" label="for the whole trip" />
        </StatGroup>
      </div>
    </main>
  );
}
