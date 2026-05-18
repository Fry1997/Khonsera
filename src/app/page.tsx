import Link from "next/link";
import { FlankEyebrow, Masthead, Stat, StatGroup } from "@/components/ui/editorial";

export default function LandingPage() {
  return (
    <main className="paper-tex flex min-h-screen flex-col">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-10 px-5 py-12 sm:gap-12 sm:px-6 sm:py-16">
        <div className="brand-glyph">Journies</div>

        <Masthead
          eyebrow={<FlankEyebrow align="left">A travel-aware visit planner</FlankEyebrow>}
          title="Know whether you can"
          em="actually get there"
          trailing={<span className="text-ink">— before you say yes.</span>}
          standfirst={
            <>
              Plan, book, calendar and navigate on-site business visits door to
              door. Travel-aware feasibility, <em>rail vs drive</em> comparison,
              partner rail booking and travel-day guidance.
            </>
          }
          actions={
            <>
              <Link href="/login" className="btn-terra">
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
