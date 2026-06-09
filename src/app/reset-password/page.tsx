import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { setNewPassword } from "./actions";

// Reset password — Design Round 2 auth template.
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;

  // /auth/callback exchanges the recovery code into a session before this.
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    redirect("/forgot-password?error=Reset%20link%20expired%20or%20already%20used");
  }

  return (
    <main className="cc-auth paper-tex">
      <div className="cc-auth-inner">
        <span className="cc-auth-lockup">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/mk-brass.png" alt="" />
          <span className="wm">KHONSERA</span>
        </span>

        <h1 className="cc-auth-greeting">
          Almost <em>there.</em>
        </h1>
        <p className="cc-auth-sub">Set a new password to finish.</p>

        <form
          action={setNewPassword}
          className="cc-auth-card"
          style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}
        >
          <div className="cc-auth-field">
            <label>New password</label>
            <input name="password" type="password" required minLength={8} autoComplete="new-password" className="field" />
          </div>
          <div className="cc-auth-field" data-error={sp.error ? "true" : "false"}>
            <label>Confirm</label>
            <input name="confirm" type="password" required minLength={8} autoComplete="new-password" className="field" />
          </div>
          {sp.error ? <p className="cc-auth-error">{sp.error}</p> : null}
          <button type="submit" className="cc-btn cc-btn-gold cc-btn-block">
            Save password
          </button>
        </form>

        <p className="cc-auth-creed">Calm · Considered · Precise</p>
      </div>
    </main>
  );
}
