import Link from "next/link";
import { signup } from "./actions";

// Signup — Design Round 2 auth template ("The Midnight Threshold", `.cc-auth-*`).
export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  const err = sp.error ? "true" : "false";
  return (
    <main className="cc-auth" style={{ minHeight: "100dvh" }}>
      <div className="cc-auth-inner">
        <span className="cc-auth-lockup">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/mk-brass.png" alt="" />
          <span className="wm">KHONSERA</span>
        </span>

        <h1 className="cc-auth-greeting">
          Let&apos;s set <em>you up.</em>
        </h1>
        <p className="cc-auth-sub">A minute now; calmer days after.</p>

        <form
          action={signup}
          className="cc-auth-card"
          style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}
        >
          <div className="cc-auth-field">
            <label htmlFor="signup-full-name">Name</label>
            <input id="signup-full-name" name="full_name" required autoComplete="name" className="field" />
          </div>
          <div className="cc-auth-field" data-error={err}>
            <label htmlFor="signup-email">Email</label>
            <input id="signup-email" name="email" type="email" required autoComplete="email" className="field" />
          </div>
          <div className="cc-auth-field" data-error={err}>
            <label htmlFor="signup-password">Password</label>
            <input id="signup-password" name="password" type="password" required autoComplete="new-password" className="field" />
          </div>
          {sp.error ? <p className="cc-auth-error">{sp.error}</p> : null}
          <button type="submit" className="cc-btn cc-btn-gold cc-btn-block">
            Create account
          </button>
        </form>

        <div className="cc-auth-links">
          <span style={{ color: "var(--t-dim, var(--ink-dim))" }}>Already have one?</span>
          <Link href="/login" className="cc-auth-link-gold">
            Sign in
          </Link>
        </div>

        <p className="cc-auth-creed">Calm · Considered · Precise</p>
      </div>
    </main>
  );
}
