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
    "Forward your booking confirmations or add them by hand. Khonsera threads the plan, works the time around it back to the minute, and watches the world so you don't have to. The calm organising layer above the booking sites.",
  openGraph: {
    title: "Khonsera — your travel, quietly handled.",
    description:
      "The calm organising layer above the booking sites. Bring it the fixed points of your day; it works out everything in between, and keeps watch as things change.",
    siteName: "Khonsera",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Khonsera — your travel, quietly handled.",
    description:
      "The calm organising layer above the booking sites. Bring it your bookings; it handles the rest.",
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

// Three props pushed to mechanism (Round-3 revision — show the engine, not the mood).
const VALUE_PROPS = [
  {
    k: "Plan the whole journey",
    d: "Every leg, door to door. Not the flight in isolation — the taxi, the platform change, the walk at the other end.",
  },
  {
    k: "Hold the timing",
    d: "A live leave-by for every step, recalculated as conditions move. The maths happens so you don't.",
  },
  {
    k: "Stay ahead of trouble",
    d: "Delays, cancellations, platform changes — caught and re-planned before they reach you.",
  },
];

// The in-context app shot (Round-3 proof layer). A phone rendering the live
// planning view for the worked example. Geneva→home deliberately (sidesteps the
// Leicester–Derby routing bug per Design's note); swap to UK rail when fixed.
function TrainIco() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="5" y="3.5" width="14" height="13" rx="3" />
      <path d="M5 10h14" />
      <path d="M8 16.5 6 20M16 16.5 18 20" />
    </svg>
  );
}

function AppShot() {
  return (
    <div className="cc-shot" aria-label="Khonsera planning view">
      <div className="cc-shot-phone">
        <div className="cc-shot-screen">
          <div className="cc-shot-head">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <span className="cc-shot-wm"><img src="/brand/mk-ink.png" alt="" />KHONSERA</span>
            <span className="cc-shot-day">Today · Geneva → home</span>
          </div>
          <div className="cc-shot-tile">
            <span className="cc-shot-status"><span className="dot" />On track</span>
            <div className="cc-shot-headline">Make the 17:05 from Gare Cornavin</div>
            <div className="cc-shot-leaveby"><span className="l">Leave the lounge by</span><span className="v">16:48</span></div>
            <div className="cc-shot-next"><span>Next · Platform 3</span><span className="cc-shot-mono">17:05</span></div>
          </div>
          <div className="cc-shot-spine">
            <div className="cc-shot-rail" />
            <div className="cc-shot-node"><span className="d d-done" /><div><div className="t">16:40</div><div className="n">Landed · Genève Aéroport</div></div></div>
            <div className="cc-shot-node"><span className="d d-now" /><div><div className="t cc-gold">17:05 · now boarding soon</div><div className="n">Train to Gare Cornavin</div><div className="s">Platform 3 · 27 min</div></div></div>
            <div className="cc-shot-node"><span className="d d-leg" /><div><div className="t">19:30</div><div className="n">Dinner · Café du Centre</div><div className="s cc-italic">held — you&apos;ll arrive 19:12</div></div></div>
          </div>
          <div className="cc-shot-nudge">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/mk-ink.png" alt="" />
            <span>If the 17:05 is pulled, the 17:21 still makes dinner. I&apos;m watching it.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function AppShotTicket() {
  return (
    <div className="cc-shot" aria-label="Khonsera plan with a booked ticket">
      <div className="cc-shot-phone">
        <div className="cc-shot-screen">
          <div className="cc-shot-head">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <span className="cc-shot-wm"><img src="/brand/mk-ink.png" alt="" />KHONSERA</span>
            <span className="cc-shot-day">Plan · Geneva → home</span>
          </div>
          <div className="cc-shot-spine">
            <div className="cc-shot-rail" />
            <div className="cc-shot-node"><span className="d d-done" /><div><div className="t">16:40</div><div className="n">Landed · Genève Aéroport</div></div></div>
            <div className="cc-shot-node cc-shot-ticketnode">
              <span className="d d-now" />
              <div className="cc-tkt">
                <div className="cc-tkt-band"><span className="cc-tkt-op"><span className="k">Rail</span>LNER</span><span className="cc-tkt-ref">CH-4471</span></div>
                <div className="cc-tkt-route">
                  <span className="cc-tkt-end"><span className="cc-tkt-time">17:05</span><span className="cc-tkt-place">Gare Cornavin</span></span>
                  <span className="cc-tkt-link"><TrainIco /></span>
                  <span className="cc-tkt-end" style={{ textAlign: "right" }}><span className="cc-tkt-time">17:33</span><span className="cc-tkt-place">Aéroport</span></span>
                </div>
                <div className="cc-tkt-foot">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <span className="cc-tkt-azt"><img src="/brand/ticket-aztec.png" alt="Ticket barcode" /></span>
                  <span className="cc-tkt-ready"><span className="dot" />Ticket ready</span>
                  <span className="cc-tkt-seat">Coach 4 · 28</span>
                </div>
              </div>
            </div>
            <div className="cc-shot-node"><span className="d d-leg" /><div><div className="t">19:30</div><div className="n">Dinner · Café du Centre</div><div className="s cc-italic">held — you&apos;ll arrive 19:12</div></div></div>
          </div>
          <div className="cc-shot-nudge">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/mk-ink.png" alt="" />
            <span>Booked. I&apos;ll keep the platform live and move it if the 17:05 slips.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

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
        {/* Hero — copy + the live planning view (the proof layer) */}
        <section className="cc-mkt-hero">
          <div className="cc-mkt-hero-copy">
            <span className="cc-mkt-hero-eyebrow">A travel concierge · est. MMXXVI</span>
            <h1 className="cc-mkt-headline">Your travel, quietly handled.</h1>
            <p className="cc-mkt-sub">
              Forward your confirmations, or add them by hand &mdash; the flight, the dinner, the
              meeting. Khonsera threads them into a door-to-door plan and keeps the timing live, so{" "}
              <em>you&apos;re never the one doing the arithmetic.</em>
            </p>
            <a href="#waitlist" className="cc-btn cc-btn-gold cc-mkt-hero-cta">
              Join the waitlist
            </a>
            <div className="cc-mkt-hero-meta">By invitation</div>
          </div>
          <div className="cc-mkt-hero-shot">
            <AppShot />
          </div>
        </section>

        {/* What it is */}
        <section className="cc-mkt-section">
          <span className="cc-mkt-eyebrow">What it is</span>
          <p className="cc-mkt-lede">
            You give it the facts; it builds the plan, holds the timing, and watches live conditions —
            so a missed connection becomes <em>a new plan, not a crisis.</em>
          </p>
          <p className="cc-mkt-body">
            It doesn&apos;t book your tickets or replace your apps. It&apos;s the layer that makes them
            all hold together.
          </p>
        </section>

        {/* What it looks like — the worked example (the biggest proof) */}
        <section className="cc-mkt-section cc-mkt-example">
          <div className="cc-mkt-example-copy">
            <span className="cc-mkt-eyebrow">What it looks like</span>
            <p className="cc-mkt-lede" style={{ maxWidth: "32ch" }}>
              You land at 16:40. Dinner&apos;s booked for 19:30 in town.
            </p>
            <p className="cc-mkt-example-note">
              Khonsera works backwards: the 17:05 train is the one to make — and if it&apos;s cancelled,
              you&apos;ll know before the departure board does.
            </p>
          </div>
          <div className="cc-mkt-example-shot">
            <AppShotTicket />
          </div>
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
            For working people with real days to hold together —{" "}
            <em>the executive treatment, without the executive.</em>
          </p>
        </section>

        {/* Waitlist block — framed in bone, the one conversion moment */}
        <section id="waitlist" className="cc-mkt-waitlist">
          <div className="cc-mkt-waitlist-inner">
            <h2 className="cc-mkt-waitlist-h">Join the waitlist.</h2>
            <p className="cc-mkt-waitlist-sub">
              Khonsera opens by invitation, a few people at a time. Leave your email and we&apos;ll
              keep your place.
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
