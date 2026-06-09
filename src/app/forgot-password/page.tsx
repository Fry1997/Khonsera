import Link from "next/link";
import { requestPasswordReset } from "./actions";

// Forgot password — Design Round 2 auth template, with the success state.
export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const sp = await searchParams;
  const sent = sp.sent === "1";
  return (
    <main className="cc-auth paper-tex">
      <div className="cc-auth-inner">
        <span className="cc-auth-lockup">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/mk-brass.png" alt="" />
          <span className="wm">KHONSERA</span>
        </span>

        <h1 className="cc-auth-greeting">
          We&apos;ll send <em>a link.</em>
        </h1>
        <p className="cc-auth-sub">A new password, a minute away.</p>

        {sent ? (
          <div className="cc-auth-success">
            <span className="ic">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M4 6h16v12H4z M4 7l8 6 8-6" />
              </svg>
            </span>
            <p>Check your inbox. If an account exists for that email, a reset link is on its way.</p>
          </div>
        ) : (
          <form
            action={requestPasswordReset}
            className="cc-auth-card"
            style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}
          >
            <div className="cc-auth-field" data-error={sp.error ? "true" : "false"}>
              <label>Email</label>
              <input name="email" type="email" required autoComplete="email" className="field" />
            </div>
            {sp.error ? <p className="cc-auth-error">{sp.error}</p> : null}
            <button type="submit" className="cc-btn cc-btn-gold cc-btn-block">
              Send reset link
            </button>
          </form>
        )}

        <div className="cc-auth-links" style={{ justifyContent: "center" }}>
          <Link href="/login" className="cc-auth-link">
            Back to sign in
          </Link>
        </div>

        <p className="cc-auth-creed">Calm · Considered · Precise</p>
      </div>
    </main>
  );
}
