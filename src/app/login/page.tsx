import Link from "next/link";
import { login } from "./actions";

// Login — Design Round 2 auth template (`.cc-auth-*`). Locked emblem, a warm
// one-word Spectral accent, the .field form, calm inline error.
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const sp = await searchParams;
  return (
    <main className="cc-auth paper-tex">
      <div className="cc-auth-inner">
        <span className="cc-auth-lockup">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/mk-ink.png" alt="" />
          <span className="wm">KHONSERA</span>
        </span>

        <h1 className="cc-auth-greeting">
          Welcome <em>back.</em>
        </h1>
        <p className="cc-auth-sub">The evening, kept.</p>

        <form
          action={login}
          className="cc-auth-card"
          style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}
        >
          <input type="hidden" name="next" value={sp.next ?? "/today"} />
          <div className="cc-auth-field" data-error={sp.error ? "true" : "false"}>
            <label>Email</label>
            <input name="email" type="email" required autoComplete="email" className="field" />
          </div>
          <div className="cc-auth-field" data-error={sp.error ? "true" : "false"}>
            <label>Password</label>
            <input name="password" type="password" required autoComplete="current-password" className="field" />
          </div>
          {sp.error ? <p className="cc-auth-error">{sp.error}</p> : null}
          <button type="submit" className="cc-btn cc-btn-gold cc-btn-block">
            Sign in
          </button>
        </form>

        <div className="cc-auth-links">
          <Link href="/forgot-password" className="cc-auth-link">
            Forgot password?
          </Link>
          <Link href="/signup" className="cc-auth-link-gold">
            Create account
          </Link>
        </div>
      </div>
    </main>
  );
}
