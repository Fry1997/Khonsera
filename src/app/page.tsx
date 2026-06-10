import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import type { Metadata } from "next";
import { getSessionUser } from "@/lib/auth";
import { isApproved } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/login/actions";
import { WaitlistForm } from "@/components/landing/waitlist-form";
import { WAITLIST_COOKIE } from "@/lib/waitlist-shared";

// Landing+waitlist brief — `/` is the PUBLIC front door, not the login wall.
// Three visitor states (§3): logged-out marketing+waitlist · logged-in approved
// passes through to /today · logged-in non-approved sees the gated thank-you.
// Brand-forward, restraint-led; Code-authored on Edition II tokens, a prime
// Design elevation candidate (§9).

export const metadata: Metadata = {
  title: "Khonsera — your travel, quietly handled.",
  description:
    "Tell Khonsera the day in plain words. It threads the plan, works the time around it back to the minute, and watches the world so you don't have to. The calm organising layer above the booking sites.",
  openGraph: {
    title: "Khonsera — your travel, quietly handled.",
    description:
      "The calm organising layer above the booking sites. Tell it the fixed points of your day; it works out everything in between, and keeps watch as things change.",
    siteName: "Khonsera",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Khonsera — your travel, quietly handled.",
    description:
      "The calm organising layer above the booking sites. Tell it the day in plain words; it handles the rest.",
  },
};

export default async function LandingPage() {
  const user = await getSessionUser();

  if (user) {
    // Logged-in: decide by the existing identity gate. Approved → the app.
    const supabase = await createClient();
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_staff, is_admin")
      .eq("id", user.id)
      .maybeSingle();

    if (profile && isApproved({ isStaff: profile.is_staff, isAdmin: profile.is_admin })) {
      redirect("/today");
    }
    return <GatedScreen />;
  }

  // Logged-out: the marketing page. Cookie remembers a prior signup (§3).
  const jar = await cookies();
  const joined = jar.get(WAITLIST_COOKIE)?.value === "joined";

  return <Marketing joined={joined} />;
}

/* ------------------------------------------------------------------ */
/* Logged-in, not yet approved — the gated thank-you (brief §3 / §8).  */
/* ------------------------------------------------------------------ */

function GatedScreen() {
  return (
    <div className="cc-gated">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="cc-gated-emblem" src="/brand/mk-ink.png" alt="Khonsera" />
      <h1 className="cc-gated-h">Thank you — your place is reserved.</h1>
      <p className="cc-gated-sub">
        Khonsera is opening slowly. We&apos;ll write the moment{" "}
        <em>your place is ready</em> — nothing before.
      </p>
      <form action={signOut}>
        <button type="submit" className="cc-gated-signout">
          Sign out
        </button>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Logged-out — the marketing page (brief §5 sections, §8 draft copy). */
/* ------------------------------------------------------------------ */

// Three quiet props — Design's Round-3 voice ("How it helps"), not a feature list.
const VALUE_PROPS = [
  {
    k: "Plan the whole journey",
    d: "Door to door, every leg threaded — not just the flight.",
  },
  {
    k: "Hold the timing",
    d: "Leave-by, kept live, so you're never doing the arithmetic.",
  },
  {
    k: "Stay ahead of trouble",
    d: "The delay, the change — handled before it reaches you.",
  },
];

function Marketing({ joined }: { joined: boolean }) {
  return (
    <div className="cc-mkt">
      <header className="cc-mkt-top">
        <div className="cc-mkt-lockup">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/mk-ink.png" alt="" />
          <span className="wm">Khonsera</span>
        </div>
        <Link href="/login" className="cc-mkt-login">
          Log in
        </Link>
      </header>

      <main className="cc-mkt-main">
        {/* Hero — the money shot */}
        <section className="cc-mkt-hero">
          <span className="cc-mkt-hero-eyebrow">A travel concierge · est. MMXXVI</span>
          <h1 className="cc-mkt-headline">Your travel, quietly handled.</h1>
          <p className="cc-mkt-sub">
            A calm concierge for the hours between destinations —{" "}
            <em>the train that might not run, the taxi at dusk,</em> the careful
            arithmetic of getting there.
          </p>
          <a href="#waitlist" className="cc-btn cc-btn-gold cc-mkt-hero-cta">
            Join the waitlist
          </a>
          <div className="cc-mkt-hero-meta">By invitation · opening slowly</div>
        </section>

        {/* What it is */}
        <section className="cc-mkt-section">
          <span className="cc-mkt-eyebrow">What it is</span>
          <p className="cc-mkt-lede">
            A quiet hand on the in-between hours —{" "}
            <em>so the day holds together</em> without you having to hold it.
          </p>
        </section>

        {/* How it helps — three quiet props */}
        <section className="cc-mkt-section">
          <span className="cc-mkt-eyebrow">How it helps</span>
          <div className="cc-mkt-props">
            {VALUE_PROPS.map((v) => (
              <div key={v.k} className="cc-mkt-prop">
                <span className="cc-mkt-prop-dot" aria-hidden />
                <p className="cc-mkt-prop-k">{v.k}</p>
                <p className="cc-mkt-prop-d">{v.d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Who it's for */}
        <section className="cc-mkt-who">
          <span className="cc-mkt-eyebrow">Who it&apos;s for</span>
          <p className="cc-mkt-lede">
            For people who travel often and would rather{" "}
            <em>arrive than organise</em>.
          </p>
        </section>

        {/* Waitlist block — framed in bone, the one conversion moment */}
        <section id="waitlist" className="cc-mkt-waitlist">
          <div className="cc-mkt-waitlist-inner">
            <h2 className="cc-mkt-waitlist-h">Join the waitlist.</h2>
            <p className="cc-mkt-waitlist-sub">
              Khonsera opens slowly, by invitation. Leave your email and
              we&apos;ll keep your place.
            </p>
            <WaitlistForm source="landing" initialJoined={joined} />
          </div>
        </section>
      </main>

      {/* Footer — one mono line */}
      <footer className="cc-mkt-foot">
        <span className="name">Khonsera</span>
        <span>Travel days, considered.</span>
        <a className="sp" href="mailto:hello@khonsera.com">
          hello@khonsera.com
        </a>
        <span>© MMXXVI</span>
      </footer>
    </div>
  );
}
