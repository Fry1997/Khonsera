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
    <main className="cc-gated">
      <div className="cc-gated-inner">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="cc-gated-emblem" src="/brand/mk-ink.png" alt="" />
        <p className="cc-gated-lead">Thank you — your place is reserved.</p>
        <p className="cc-gated-sub">
          We&apos;ll let you know the moment your access is ready.
        </p>
        <form action={signOut} className="cc-gated-foot">
          <button type="submit" className="cc-auth-link">
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* Logged-out — the marketing page (brief §5 sections, §8 draft copy). */
/* ------------------------------------------------------------------ */

const VALUE_PROPS = [
  {
    k: "Say it plainly.",
    d: "Capture your day in plain language, in any order. Khonsera threads it into a coherent plan.",
  },
  {
    k: "Time, worked backwards.",
    d: "When to leave, which train, which connection — ranked by real door-to-door time, not guesswork.",
  },
  {
    k: "It watches, so you don't.",
    d: "Delays, gate changes, weather. Khonsera sees them coming and quietly tells you what to do.",
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
        {/* Hero */}
        <section className="cc-mkt-hero">
          <h1 className="cc-mkt-headline">Your travel, quietly handled.</h1>
          <p className="cc-mkt-sub">
            Tell Khonsera the day in plain words. It threads the plan, works the
            time around it, and watches the world so you don&apos;t have to.
          </p>
          <a href="#waitlist" className="cc-btn cc-btn-gold cc-mkt-hero-cta">
            Join the waitlist
          </a>
        </section>

        {/* What it is */}
        <section className="cc-mkt-section">
          <span className="cc-mkt-eyebrow">What it is</span>
          <p className="cc-mkt-lede">
            Not another booking site. Khonsera is the layer above them —{" "}
            <em>the part that thinks</em>. Tell it the fixed points of your day,
            in any order; it works out everything in between, back to the minute,
            and keeps watch as things change.
          </p>
        </section>

        {/* Three quiet value props */}
        <section className="cc-mkt-section">
          <div className="cc-mkt-props">
            {VALUE_PROPS.map((v) => (
              <div key={v.k} className="cc-mkt-prop">
                <span className="cc-mkt-prop-dot" aria-hidden />
                <h3 className="cc-mkt-prop-k">{v.k}</h3>
                <p className="cc-mkt-prop-d">{v.d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Who it's for */}
        <section className="cc-mkt-section cc-mkt-who">
          <span className="cc-mkt-eyebrow">Who it&apos;s for</span>
          <p className="cc-mkt-lede">
            Executive treatment, for people who don&apos;t have an assistant.
            Khonsera gives an ordinary working day the attention a private office
            would.
          </p>
        </section>

        {/* Waitlist block */}
        <section id="waitlist" className="cc-mkt-waitlist">
          <h2 className="cc-mkt-waitlist-h">
            Khonsera is being built with care.
          </h2>
          <p className="cc-mkt-waitlist-sub">
            Join the waitlist and we&apos;ll tell you the moment it opens.
          </p>
          <WaitlistForm source="landing" initialJoined={joined} />
        </section>

        {/* Footer */}
        <footer className="cc-mkt-foot">
          <span className="cc-mkt-foot-name">Khonsera</span>
          <span className="cc-mkt-foot-line">a calmer way to travel.</span>
          <span className="cc-mkt-foot-meta">
            <a href="mailto:hello@khonsera.com">contact</a>
            <span aria-hidden>·</span>
            <span>© Khonsera</span>
          </span>
        </footer>
      </main>
    </div>
  );
}
